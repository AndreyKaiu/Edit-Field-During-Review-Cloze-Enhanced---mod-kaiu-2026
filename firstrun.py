import os

from aqt import mw
from aqt.utils import showText
from aqt.qt import QTimer, QMessageBox

from .ankiaddonconfig import ConfigManager

import anki.lang
from .localization.lang import set_lang
from .localization.lang import q

conf = ConfigManager()

lng = conf.get("language", "")

addon_dir = mw.addonManager.addonFromModule(__name__)
meta = mw.addonManager.addonMeta(addon_dir)
addon_name = meta.get("name", "Edit Field During Review - Cloze (Enhanced)")

if lng == "":
    current_language = anki.lang.current_lang #en, pr-BR, en-GB, ru and the like
    sl = set_lang(current_language)
    if not sl:
        text = f"""{addon_name.upper()}! The file '{current_language+".lng"}' was not found or the file's contents could not be loaded correctly."""
        tooltip(text)       
else:
    sl = set_lang(lng)
    if not sl:
        text = f"""{addon_name.upper()}! The file '{lng+".lng"}' was not found or the file's contents could not be loaded correctly."""
        tooltip(text)



class Version:
    def __init__(self) -> None:
        self.load()

    def load(self) -> None:
        self.major = conf["version.major"]
        self.minor = conf["version.minor"]
        # v6.x has string version
        if isinstance(self.major, str):
            self.major = int(self.major)
        if isinstance(self.minor, str):
            self.major = int(self.minor)

    def __eq__(self, other: str) -> bool:  # type: ignore
        ver = [int(i) for i in other.split(".")]
        return self.major == ver[0] and self.minor == ver[1]

    def __gt__(self, other: str) -> bool:
        ver = [int(i) for i in other.split(".")]
        return self.major > ver[0] or (self.major == ver[0] and self.minor > ver[1])

    def __lt__(self, other: str) -> bool:
        ver = [int(i) for i in other.split(".")]
        return self.major < ver[0] or (self.major == ver[0] and self.minor < ver[1])

    def __ge__(self, other: str) -> bool:
        return self == other or self > other

    def __le__(self, other: str) -> bool:
        return self == other or self < other


version = Version()


# Initial installation have config version of -1.-1
# Versions before 6.0 will have config version of 0.0
# However if the user hasn't edited their config, it will show up as -1.-1


def distinguish_initial_install() -> None:
    if not version == "-1.-1":
        return
    if conf.get("undo", None):
        conf["version.major"] = 0
        conf["version.minor"] = 0
        conf.save()
        version.load()


distinguish_initial_install()


# Make config compatible when upgrading from older version


def change_resize_image_preserve_ratio() -> None:
    resize_conf = conf["resize_image_preserve_ratio"]
    if not isinstance(resize_conf, bool):
        return

    if resize_conf:
        conf["resize_image_preserve_ratio"] = 1
    else:
        conf["resize_image_preserve_ratio"] = 0
    conf.save()


change_resize_image_preserve_ratio()


def change_special_formatting() -> None:
    if not "z_special_formatting" in conf:
        return
    for key in conf["z_special_formatting"]:
        opts = conf["z_special_formatting"][key]
        if isinstance(opts, list):
            enabled = opts[0]
            arg = opts[1]
        else:
            enabled = opts
            arg = None
        conf[f"special_formatting.{key}.enabled"] = enabled
        if arg is not None:
            conf[f"special_formatting.{key}.arg"] = {
                "type": "color" if key in ["fontcolor", "highlight"] else "text",
                "value": arg,
            }

    del conf["z_special_formatting"]
    conf.save()


change_special_formatting()


def remove_undo() -> None:
    if not "undo" in conf:
        return
    del conf["undo"]
    conf.save()


remove_undo()


version_string = os.environ.get("EFDRCE_VERSION")
if not version_string:
    version_string = meta.get("human_version", "6.23.1")

tutorial = """
<style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0px; padding: 0px; backgrount-color: white;}
    h2 { text-align: center; margin-bottom: 5px; }
    h3 { color: #888; text-align: center; margin-top: 0; font-weight: normal; }
    h4 { color: #4a9eff; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 5px; }
    .section { margin-bottom: 15px; }
    .shortcut { display: inline-block; font-family: monospace; font-weight: bold; }
    ul { margin: 5px 0; padding-left: 20px; }
    li { margin: 4px 0; }
</style>""" + f"""<h2>{addon_name}<br>{q("q_Version")}: {version_string}</h2>{q("q_tutorial")}"""

def initial_tutorial() -> None:
    global tutorial, addon_name
    showText(tutorial, type="html", title=f"{addon_name}")
    

if version == "-1.-1":
    QTimer.singleShot(2000, initial_tutorial)
    

# Save current version
conf["version.major"] = int(version_string.split(".")[0])
conf["version.minor"] = int(version_string.split(".")[1])
conf.save()
