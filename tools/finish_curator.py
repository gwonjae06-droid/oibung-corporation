"""Idempotent, non-destructive curator expression staging.

Must run only after prepare_curator.py validated all four portraits. Patches
strict anchors; does not replace the user's original reference PNG.
"""
from pathlib import Path

POSES = ("neutral", "present", "explain", "alert")
for name in POSES:
    target = Path("assets/curator") / (name + ".png")
    if not target.is_file() or target.stat().st_size < 5000:
        raise SystemExit(f"Missing or invalid curator pose: {target}")

engine = Path("gallery-scenes.js")
source = engine.read_text(encoding="utf-8")
MARKER = "/* CURATOR_STAGING_V2: alpha-cutout expressions and cancellable blackout. */"
if MARKER in source:
    print("Curator staging already present; no source changes")
    raise SystemExit(0)

changes = []

def replace_one(old, new, title):
    global source
    n = source.count(old)
    if n != 1:
        raise SystemExit(f"Unsafe engine anchor ({title}): expected 1, found {n}; no code changed")
    source = source.replace(old, new, 1)
    changes.append(title)

replace_one(
    "/* Blackout engine. Existing PNG is unchanged; silhouette remains placeholder artwork. */",
    "/* Blackout engine. Original reference preserved; monster art still a placeholder. */\n" + MARKER,
    "marker"
)
replace_one(
    "const btn=a=>",
    "let curatorPose='neutral',blackoutTimer=null;\n"
    "function cancelBlackout(){if(blackoutTimer!==null){clearTimeout(blackoutTimer);blackoutTimer=null;}"
    "stage.removeAttribute('data-blackout-pending');}\n"
    "const btn=a=>",
    "state and cancellation"
)
replace_one(
    "function restore(){",
    "function restore(){cancelBlackout();curatorPose='neutral';",
    "restore after pending blackout"
)
replace_one(
    "function start(){Object.assign(S,{phase:'search',",
    "function enterDark(){Object.assign(S,{phase:'search',",
    "preserve existing blackout mechanic under enterDark"
)
replace_one(
    "function refresh(){",
    "function start(){\n"
    " cancelBlackout();if(S.phase!=='tour')return;\n"
    " curatorPose='alert';stage.dataset.blackoutPending='true';\n"
    " render('잠깐만요. 방금 복도 끝에서…');\n"
    " const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||root.classList.contains('motion-off');\n"
    " blackoutTimer=setTimeout(()=>{blackoutTimer=null;stage.removeAttribute('data-blackout-pending');enterDark();},reduced?0:1350);\n"
    "}\n"
    "function refresh(){",
    "begin blackout with same curator alert expression"
)
replace_one(
    "const small=matchMedia('(max-width:700px)').matches,variant=S.index%4;",
    "const small=matchMedia('(max-width:700px)').matches,variant=S.index%4;"
    "const poseSrc='assets/curator/'+curatorPose+'.png';"
    "if(actor.getAttribute('src')!==poseSrc)actor.src=poseSrc;",
    "display four prepared images without recreating characters"
)
replace_one(
    "function travel(target){",
    "function travel(target){cancelBlackout();curatorPose=target%2?'present':'neutral';",
    "cancel staged blackout on navigation"
)
replace_one(
    "case'night':open(notice);",
    "case'night':cancelBlackout();open(notice);",
    "cancel staged blackout on reopening dialog"
)
replace_one(
    "case'talk':{const g=games[S.index];",
    "case'talk':{cancelBlackout();curatorPose='explain';const g=games[S.index];",
    "explaining expression"
)
replace_one(
    "host.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')",
    "host.addEventListener('keydown',e=>{"
    "if(e.key==='Escape'&&stage.dataset.blackoutPending==='true'){cancelBlackout();curatorPose='neutral';render('일반 관람을 계속합니다.');return;}"
    "if(document.querySelector('dialog[open]')",
    "escape cancels staged blackout"
)
replace_one(
    "document.addEventListener('visibilitychange',volume);",
    "document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelBlackout();volume();});",
    "cancel timer when page hidden"
)
engine.write_text(source, encoding="utf-8")
print("Applied staging:", ", ".join(changes))
