"""Build a production application archive; application secrets and data are never included."""
import argparse, hashlib, json, os, pathlib, shutil, subprocess, tarfile

parser=argparse.ArgumentParser()
parser.add_argument('--output', required=True)
parser.add_argument('--composer', required=True)
args=parser.parse_args()
repo=pathlib.Path(__file__).resolve().parents[1]
output=pathlib.Path(args.output).resolve()
stage=output/'application'
if stage.exists(): raise SystemExit('Refusing to replace an existing package directory.')
stage.mkdir(parents=True)
source=repo/'backend'
for name in ['app','config','routes','database/migrations','resources/views']:
    shutil.copytree(source/name,stage/name)
for name in ['artisan','composer.json','composer.lock','bootstrap/app.php','bootstrap/providers.php','public/index.php']:
    target=stage/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/name,target)
shutil.copy2(repo/'dist/index.html',stage/'public/spa.html')
for name in ['assets','fonts']:shutil.copytree(repo/'dist'/name,stage/'public'/name)
shutil.copy2(repo/'dist/robots.txt',stage/'public/robots.txt')
for name in ['bootstrap/cache','storage/framework/cache/data','storage/framework/sessions','storage/framework/views','storage/logs','storage/app/private','database/factories','database/seeders']:
    (stage/name).mkdir(parents=True,exist_ok=True)
subprocess.run(['php',args.composer,'install','--no-dev','--no-interaction','--prefer-dist','--optimize-autoloader','--no-scripts'],cwd=stage,check=True)
(stage/'.htaccess').write_text('Require all denied\n',encoding='utf8')
files=[p for p in stage.rglob('*') if p.is_file()]
assert not any(p.name=='.env' or p.suffix in ('.sqlite','.enc') for p in files)
archive=output/'team-application.tar.gz'
with tarfile.open(archive,'w:gz') as tar:
    for p in sorted(files):
        info=tar.gettarinfo(str(p),arcname=p.relative_to(stage).as_posix())
        info.uid=info.gid=0;info.uname=info.gname='';info.mode=0o600
        with p.open('rb') as f:tar.addfile(info,f)
digest=hashlib.sha256(archive.read_bytes()).hexdigest()
manifest={'file':archive.name,'sha256':digest,'files':len(files),'contains_runtime_secrets':False}
(output/'package.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
print(json.dumps(manifest))
