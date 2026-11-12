"""Install the first Team release in its dedicated, previously empty application directory."""
import argparse, hashlib, json, os, pathlib, pwd, shutil, socket, subprocess, tarfile
parser=argparse.ArgumentParser()
parser.add_argument('archive');parser.add_argument('sha256');args=parser.parse_args()
assert pwd.getpwuid(os.getuid()).pw_name=='horcwnciix' and socket.gethostname()=='s78.cyber-folks.pl'
root=pathlib.Path('/home/horcwnciix/domains/team.intelispaces.pl/public_html')
ops=pathlib.Path('/home/horcwnciix/intelispaces-team-ops')
app=root/'app'
assert root.resolve()==root and not app.exists()
archive=pathlib.Path(args.archive)
assert archive.parent.resolve()==ops
assert hashlib.sha256(archive.read_bytes()).hexdigest()==args.sha256
env=(ops/'production.env').read_text()
for expected in ['APP_ENV=production','APP_DEBUG=false','APP_URL=https://team.intelispaces.pl','DB_DATABASE=horcwnciix_team','DB_USERNAME=horcwnciix_team','SESSION_ENCRYPT=true','SESSION_SECURE_COOKIE=true']:
    assert expected in env.splitlines()
backup=ops/'before-first-install';backup.mkdir(mode=0o700)
for name in ['index.html','.htaccess']:
    if (root/name).is_file():shutil.copy2(root/name,backup/name)
app.mkdir(mode=0o700)
(app/'.htaccess').write_text('Require all denied\n')
with tarfile.open(archive,'r:gz') as tar:
    for member in tar.getmembers():
        target=pathlib.PurePosixPath(member.name)
        assert member.isfile() and not target.is_absolute() and '..' not in target.parts
        assert target.parts[0] in {'app','bootstrap','config','database','public','resources','routes','vendor','artisan','composer.json','composer.lock','.htaccess'}
        assert '.env' not in target.parts and not member.name.endswith(('.sqlite','.enc'))
        destination=app/member.name;destination.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        with tar.extractfile(member) as source,destination.open('wb') as output:shutil.copyfileobj(source,output)
        destination.chmod(0o600)
for name in ['bootstrap/cache','storage/framework/cache/data','storage/framework/sessions','storage/framework/views','storage/logs','storage/app/private']:
    (app/name).mkdir(parents=True,exist_ok=True,mode=0o700)
(app/'.env').write_text(env);(app/'.env').chmod(0o600)
php='/opt/alt/php84/usr/bin/php'
for command in [('package:discover',),('migrate','--force','--no-interaction'),('config:cache',),('route:cache',)]:
    subprocess.run([php,str(app/'artisan'),*command],cwd=app,check=True)
for name in ['assets','fonts']:
    assert not (root/name).exists()
    shutil.copytree(app/'public'/name,root/name)
    for path in (root/name).rglob('*'):path.chmod(0o755 if path.is_dir() else 0o644)
    (root/name).chmod(0o755)
shutil.copyfile(app/'public/robots.txt',root/'robots.txt');(root/'robots.txt').chmod(0o644)
gateway="""# InteliSpaces Team gateway
Options -Indexes
DirectoryIndex index.php
RewriteEngine On
RewriteCond %{HTTP_HOST} !^team\\.intelispaces\\.pl$ [NC]
RewriteRule ^ - [F,END]
RewriteRule ^(?:app|cgi-bin)(?:/|$) - [F,END]
RewriteRule (^|/)\\. - [F,END]
RewriteCond %{HTTPS} !=on
RewriteRule ^ https://team.intelispaces.pl%{REQUEST_URI} [R=308,END]
RewriteRule ^(?:index\\.html)?$ index.php [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.php [L]
AddHandler application/x-httpd-php84 php
<IfModule mod_headers.c>
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "DENY"
Header always set X-Robots-Tag "noindex, nofollow, noarchive"
Header always set Referrer-Policy "no-referrer"
Header always unset X-Powered-By
</IfModule>
"""
(root/'.htaccess').write_text(gateway)
(root/'index.php').write_text("<?php\nrequire __DIR__.'/app/public/index.php';\n")
(root/'.user.ini').write_text('upload_max_filesize=5M\npost_max_size=7M\ndisplay_errors=Off\nlog_errors=On\nexpose_php=Off\nsession.cookie_secure=1\nsession.cookie_httponly=1\n')
for name in ['.htaccess','.user.ini','index.php']:(root/name).chmod(0o644)
(ops/'installed.json').write_text(json.dumps({'sha256':args.sha256,'root':str(root),'database':'horcwnciix_team'}))
print(json.dumps({'installed':True,'database':'horcwnciix_team','domain':'team.intelispaces.pl'}))
