"""Run the published, unchanged plugin in a NEW real DSH profile and Edge.

No default browser profile, daily DSH config, paid models or source patches.
All child process credentials/URLs and raw logs stay under run-root/private.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import datetime

BUNDLE=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument("--config",type=Path,required=True)
parser.add_argument("--run-root",type=Path,required=True)
args=parser.parse_args()
config=json.loads(args.config.read_text(encoding="utf-8-sig"))
run=args.run_root.resolve()
assert not run.exists(),"Use a new run root; old records are never overwritten."
private=run/"private"
private.mkdir(parents=True)
results=run/"results"
results.mkdir()
env={k:v for k,v in os.environ.items() if not k.startswith("DSH_") and
     not any(t in k.upper() for t in ["API_KEY","ACCESS_TOKEN","AUTH_TOKEN","SECRET_KEY","PASSWORD"])}
for k,dirname in [("DSH_HOME","home"),("DSH_WE_DATA_DIR","data"),("DSH_WE_CACHE_DIR","cache"),
                   ("DSH_WE_UPLOAD_DIR","uploads"),("DSH_WE_STEAM_ROOT","steam"),("TEMP","temp"),("TMP","temp")]:
    d=run/dirname;d.mkdir(exist_ok=True);env[k]=str(d)
env["DSH_PROMPT_FILE"]=str(run/"home"/"prompts.yml")
env["PYTHONUTF8"]="1"
marker=run/"steam/steamapps/common/wallpaper_engine/distribution"
marker.mkdir(parents=True)
(marker/"version.json").write_text('{"synthetic":true}',encoding="utf8")
archive=BUNDLE/"package/dsh-plugin-wallpaper-engine-1.3.3.tgz"
assert hashlib.sha256(archive.read_bytes()).hexdigest()=="52d7ababdccf0bfa289196914493af8d61a8802f253c9f6ceefe079e70421c67"
cli=[config["node"],config["dshCli"]]
steps=[]

def checked(name,cmd):
    start=time.monotonic()
    with (private/(name+".stdout.txt")).open("xb") as out,(private/(name+".stderr.txt")).open("xb") as err:
        p=subprocess.run(cmd,cwd=run,env=env,stdout=out,stderr=err,timeout=180)
    steps.append({"name":name,"exitCode":p.returncode,"seconds":round(time.monotonic()-start,3)})
    print(name,p.returncode,flush=True)
    p.check_returncode()

checked("profile-init",cli+["--profile","wallpaper-public","--from-default-profile","web","--dump-config"])
checked("install",cli+["plugin","--profile","wallpaper-public","add",str(archive)])
workspace=run/"workspace";workspace.mkdir()
wid="563a3b08-721a-420c-a8cc-6ad4f0643b9a"
stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
store=run/"home/storages";store.mkdir(exist_ok=True)
(store/"workspace.json").write_text(json.dumps({
    "unit":{"name":"workspace","version":2},
    "global":{"initialized":True,"workspaceIds":[wid],"archivedSessionIds":[],"pinnedSessionIds":[],"defaultWorkspaceId":wid},
    "tables":{"workspaces":{wid:{"path":str(workspace),"title":"Frontend review fixture","sessionIds":[],"createdAt":stamp,"updatedAt":stamp}}},
}),encoding="utf8")
(run/"data/config.json").write_text(json.dumps({"settings":{"id":"","typeFilter":"image","noticeSeen":"1.3.3"}}),encoding="utf8")
hostout=(private/"host.stdout.txt").open("xb")
hosterr=(private/"host.stderr.txt").open("xb")
host=subprocess.Popen(cli+["--profile","wallpaper-public","--host","127.0.0.1","--port","0","--no-open"],
                      cwd=run,env=env,stdout=hostout,stderr=hosterr)
try:
    url=None
    for _ in range(120):
        if host.poll() is not None:raise RuntimeError("Host exited before ready; inspect private logs.")
        text=(private/"host.stdout.txt").read_text(encoding="utf8",errors="replace")
        found=re.search(r"http://127\.0\.0\.1:\d+/\?token=[A-Za-z0-9._~-]+",text)
        if found:url=found.group(0);break
        time.sleep(.5)
    assert url,"Host not ready within 60 seconds."
    (private/"host.json").write_text(json.dumps({"url":url,"pid":host.pid}),encoding="utf8")
    checked("browser-replay",[config["node"],str(BUNDLE/"repro/browser-replay.mjs"),str(args.config.resolve()),str(run)])
finally:
    host.terminate()
    try:host.wait(timeout=20)
    except subprocess.TimeoutExpired:
        host.kill();host.wait(timeout=10)
    hostout.close();hosterr.close()
    (results/"steps.json").write_text(json.dumps({"steps":steps,"hostTermination":"only our child process; intentionally stopped"},indent=2),encoding="utf8")
print("REPLAY_COMPLETED: see results/public-result.json; private logs must not be published.",flush=True)
