# o!TDB: osu! Tournament Database
A database website for osu tournaments, mappools, and users.

Links:
- [Website](https://otdb.sheppsu.me)
- [Discord](https://discord.gg/zSRrT7KHEV)

# Bugs, feature request, and contributing
- For bugs and feature requests, create an [issue](https://github.com/Sheppsu/otdb/issues).
- Contributions are more than welcome, as long as you're following these guidelines:
  - Pull requests should either be based on an existing issue, or an issue should be created beforehand. If you're working on something, make it clear in the related issue to avoid clashing with others' work.

# Running locally
Requires:
- Python 3.12+, maybe 3.10/11 works I'm not sure
- postgresql
- node.js

Steps to setup:
- clone repository with `git clone https://github.com/Sheppsu/otdb.git`
- install python requirements with `pip install -r requirements.txt`
- create a postgresql database; you can find instructions online
- run the sql files in /sql
- make a copy of otdb/template.env named ".env" and fill in the values
- run `npm install` in /otdb/ts
- run `py manage.py migrate` in /otdb/ts
- if you have any issues, create an [issue](https://github.com/Sheppsu/otdb/issues) with the 'development help' tag or ping me in the [discord](https://discord.gg/zSRrT7KHEV)

Steps to run:
- python command depends on machine, but in /otdb `py manage.py runserver` to run the site
- in /otdb/ts `py build.py --debug --watch` to build js and css files (the flags are optional)
  - `--debug` will create a debug version of bundled files (js isn't minimized)
  - `--watch` will watch for changes in ts/css files and automatically rebuild
