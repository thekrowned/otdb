import os
from time import sleep, monotonic
import sys
import shutil
import itertools


TS_DIR = "."
JS_DIR = os.path.join(os.path.pardir, "static", "js")
CSS_DIR = os.path.join(os.path.pardir, "static", "css")
BUNDLE_UNFINISHED = os.path.join(os.path.pardir, "static", "js", "bundled-unfinished.js")
BUNDLED = os.path.join(os.path.pardir, "static", "js", "bundled.js")
BUNDLED_CSS = os.path.join(os.path.pardir, "static", "css", "bundled.css")

DEBUG = "--debug" in sys.argv


def fix_imports_for(outfile, path, context):
    comment = f"/* {os.path.split(path)[1]}: %4d */ "

    with open(path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f.readlines()):
            if line.startswith("const") or line.startswith("var") or line.startswith("let"):
                var = line.split(" ", 3)[1]
                if var in context["variables"]:
                    continue
                context["variables"].append(var)

            if "import" in line and "http" not in line:
                continue
            if line.startswith("export") and not line.split("(", 2)[0].endswith("Setup"):
                outfile.write((comment % (i + 1))+line[15 if "default" in line else 7:])
            else:
                outfile.write((comment % (i + 1))+line)


def bundle(outfile):
    context = {
        "variables": []
    }

    def bundle_js(root, files):
        for file in files:
            if file.endswith(".js") and not file.startswith("bundled"):
                fix_imports_for(outfile, os.path.join(root, file), context)

    # first bundle core js
    bundle_js(JS_DIR, (file for file in os.listdir(JS_DIR) if file != "base.js"))

    # next bundle commonly utilized js
    for root, _, files in os.walk(os.path.join(JS_DIR, "common")):
        bundle_js(root, files)

    # now the base.js can be bundled
    bundle_js(JS_DIR, ["base.js"])

    # bundle everything else
    for root, _, files in os.walk(JS_DIR):
        pardir = os.path.split(root)[1]
        if pardir == "common" or pardir == "js":
            continue
        bundle_js(root, files)

    # very big nest :P just puts all the css in one file
    with open(BUNDLED_CSS, "w") as outf:
        for root, _, files in os.walk(CSS_DIR):
            for file in files:
                if file.endswith(".css"):
                    with open(os.path.join(root, file), "r") as f:
                        for line in f.readlines():
                            line = line.strip()
                            if len(line) > 0 and not line.startswith("/*"):
                                outf.write(line)


def build():
    now = monotonic()

    if os.path.isdir(JS_DIR):
        shutil.rmtree(JS_DIR)
    os.mkdir(JS_DIR)

    if os.system("npm run build") == 0:
        print("Bundling")

        if os.path.isfile(BUNDLED):
            os.remove(BUNDLED)
        if os.path.isfile(BUNDLE_UNFINISHED):
            os.remove(BUNDLE_UNFINISHED)

        outpath = BUNDLE_UNFINISHED if not DEBUG else BUNDLED

        with open(outpath, "w") as f:
            bundle(f)

        if not DEBUG:
            os.system("npm run optimize_bundled")
            os.remove(outpath)

    print(f"Build finished in {round(monotonic() - now, 2)} seconds")


class FileWatcher:
    def __init__(self):
        self.files = {}

    def check_file(self, file):
        if (
            file.is_file() and
            (file.name.endswith(".ts") or file.name.endswith(".tsx") or file.name.endswith(".css")) and
            not file.name.startswith("bundled")
        ):
            stats = file.stat()
            if file.path not in self.files or stats.st_mtime > self.files[file.path]:
                self.files[file.path] = stats.st_mtime
                return True

        return False

    def watch(self):
        while True:
            rebuild = False
            for root, _, _ in itertools.chain(os.walk(TS_DIR), os.walk(CSS_DIR)):
                with os.scandir(root) as it:
                    for f in it:
                        rebuild = self.check_file(f) or rebuild
            
            if rebuild:
                build()

            sleep(0.5)


if __name__ == "__main__":
    if "--watch" in sys.argv:
        watcher = FileWatcher()
        try:
            watcher.watch()
        except KeyboardInterrupt:
            pass
    else:
        build()
