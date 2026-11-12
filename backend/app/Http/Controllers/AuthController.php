<?php

namespace App\Http\Controllers;

use App\Http\Middleware\RequireIdentity;
use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

class AuthController extends Controller
{
    private function audit(Request $request, string $event, ?string $userId = null): void
    {
        DB::table('audit_events')->insert(['event' => $event, 'user_id' => $userId,
            'ip_hash' => hash_hmac('sha256', $request->ip() ?? '', config('app.key')), 'created_at' => now()]);
    }

    public function session(Request $request): JsonResponse
    {
        if ($request->user() && ! RequireIdentity::valid($request)) {
            RequireIdentity::clear($request);
        }
        $user = $request->user();
        $member = $user ? DB::table('memberships')->where('user_id', $user->id)->where('board_id', config('team.board_id'))->first() : null;
        if ($user && ! $member) {
            RequireIdentity::clear($request);
            $user = null;
        }
        $state = ! $user ? 'anonymous' : (! $user->mfa_confirmed_at ? 'setup' : (! $request->session()->get('mfa_verified') ? 'challenge' : 'authenticated'));

        return response()->json(['state' => $state, 'csrf' => csrf_token(), 'resetEnabled' => config('team.password_reset_enabled'),
            'user' => $state === 'authenticated' ? ['id' => $user->id, 'email' => $user->email, 'name' => $member->display_name, 'role' => $member->role] : null]);
    }

    public function login(Request $request): JsonResponse
    {
        $input = $request->validate(['email' => ['required', 'email', 'max:254'], 'password' => ['required', 'string', 'max:1024']]);
        $user = User::where('email', mb_strtolower(trim($input['email'])))->first();
        $hash = $user?->password ?? '$2y$12$XPOzR85JMfXY5PHnQBPSLuKxdvbOmaS6wsiyZRh9Qv.9673QcP8JS';
        $valid = password_verify($input['password'], $hash);
        if (! $valid || ! $user?->active || ! $user?->email_verified_at
            || ! DB::table('memberships')->where('user_id', $user->id)->exists()) {
            $this->audit($request, 'login.failed');

            return response()->json(['message' => 'Nie udało się zalogować. Sprawdź e-mail i hasło.'], 422);
        }
        if (password_needs_rehash($hash, PASSWORD_BCRYPT, ['cost' => 12])) {
            User::whereKey($user->id)->where('password', $hash)->update(['password' => Hash::make($input['password'])]);
        }
        RequireIdentity::clear($request);
        Auth::login($user, false);
        $request->session()->regenerate();
        $request->session()->put(['password_at' => now()->timestamp, 'seen_at' => now()->timestamp,
            'auth_version' => $user->auth_version, 'mfa_verified' => false]);
        $this->audit($request, 'login.password_verified', $user->id);

        return $this->session($request);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->audit($request, 'logout', $request->user()?->id);
        RequireIdentity::clear($request);

        return response()->json(['csrf' => csrf_token()]);
    }

    public function setup(Request $request, Google2FA $totp): JsonResponse
    {
        abort_if($request->user()->mfa_confirmed_at !== null, 409);
        $secret = $request->session()->get('pending_mfa_secret');
        if (! $secret) {
            $secret = $totp->generateSecretKey(32);
            $request->session()->put('pending_mfa_secret', $secret);
        }
        $uri = $totp->getQRCodeUrl('InteliSpaces Team', $request->user()->email, $secret);
        $writer = new Writer(new ImageRenderer(new RendererStyle(240), new SvgImageBackEnd));

        return response()->json(['secret' => $secret, 'qr' => 'data:image/svg+xml;base64,'.base64_encode($writer->writeString($uri))]);
    }

    public function confirmSetup(Request $request, Google2FA $totp): JsonResponse
    {
        $input = $request->validate(['code' => ['required', 'string', 'regex:/^\d{6}$/D']]);
        $secret = $request->session()->get('pending_mfa_secret');
        abort_unless(is_string($secret), 422, 'Rozpocznij konfigurację ponownie.');
        $step = $totp->verifyKeyNewer($secret, $input['code'], 0, 1);
        abort_unless($step !== false, 422, 'Nieprawidłowy kod. Spróbuj z aktualnym kodem z aplikacji.');
        $codes = array_map(fn () => bin2hex(random_bytes(8)), range(1, 10));
        DB::transaction(function () use ($request, $secret, $step, $codes): void {
            $user = User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            abort_if($user->mfa_confirmed_at !== null, 409);
            $user->mfa_secret = $secret;
            $user->mfa_confirmed_at = now();
            $user->mfa_last_step = $step;
            $user->recovery_hashes = array_map(fn ($code) => hash('sha256', $code), $codes);
            $user->save();
        });
        $request->session()->forget('pending_mfa_secret');
        $request->session()->put('mfa_verified', true);
        $request->session()->regenerate();
        $this->audit($request, 'mfa.enrolled', $request->user()->id);

        return response()->json(['codes' => $codes, 'csrf' => csrf_token()]);
    }

    public function challenge(Request $request, Google2FA $totp): JsonResponse
    {
        $input = $request->validate(['code' => ['required', 'string', 'max:32']]);
        $valid = DB::transaction(function () use ($request, $totp, $input): bool {
            $user = User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            if (! $user->mfa_confirmed_at || ! $user->mfa_secret) {
                return false;
            }
            $code = preg_replace('/[\s-]/', '', $input['code']);
            if (preg_match('/^\d{6}$/D', $code)) {
                $step = $totp->verifyKeyNewer($user->mfa_secret, $code, $user->mfa_last_step, 1);
                if ($step === false) {
                    return false;
                }
                $user->mfa_last_step = $step;
            } else {
                $hashes = $user->recovery_hashes ?? [];
                $hash = hash('sha256', mb_strtolower($code));
                $index = array_search($hash, $hashes, true);
                if ($index === false) {
                    return false;
                }
                unset($hashes[$index]);
                $user->recovery_hashes = array_values($hashes);
            }
            $user->save();

            return true;
        });
        if (! $valid) {
            $this->audit($request, 'mfa.failed', $request->user()->id);

            return response()->json(['message' => 'Nieprawidłowy lub już użyty kod. Wpisz nowy kod z aplikacji.'], 422);
        }
        $request->session()->put('mfa_verified', true);
        $request->session()->regenerate();
        $this->audit($request, 'login.completed', $request->user()->id);

        return $this->session($request);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        abort_unless(config('team.password_reset_enabled'), 503, 'Odzyskanie dostępu wymaga kontaktu z administratorem.');
        $input = $request->validate(['email' => ['required', 'email', 'max:254']]);
        $email = mb_strtolower(trim($input['email']));
        if (User::where('email', $email)->where('active', true)->exists()) {
            Password::sendResetLink(['email' => $email]);
        }

        return response()->json(['message' => 'Jeśli konto istnieje, otrzymasz wiadomość z linkiem do ustawienia hasła.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        abort_unless(config('team.password_reset_enabled'), 503);
        $input = $request->validate(['email' => ['required', 'email', 'max:254'], 'token' => ['required', 'string', 'max:128'],
            'password' => ['required', 'string', 'min:14', 'max:72', 'confirmed', function (string $attribute, mixed $value, \Closure $fail): void {
                if (strlen($value) > 72) {
                    $fail('Hasło jest zbyt długie po zakodowaniu. Użyj maksymalnie 72 bajtów.');
                }
            }]]);
        $input['email'] = mb_strtolower(trim($input['email']));
        abort_unless(User::where('email', $input['email'])->where('active', true)->exists(), 422, 'Link jest nieprawidłowy lub wygasł.');
        $status = Password::reset($input, function (User $user, string $password): void {
            $user->password = Hash::make($password);
            $user->email_verified_at ??= now();
            $user->auth_version++;
            $user->remember_token = Str::random(60);
            $user->save();
            DB::table('sessions')->where('user_id', $user->id)->delete();
        });
        abort_unless($status === Password::PASSWORD_RESET, 422, 'Link jest nieprawidłowy lub wygasł.');
        $this->audit($request, 'password.reset');
        RequireIdentity::clear($request);

        return response()->json(['csrf' => csrf_token()]);
    }
}
