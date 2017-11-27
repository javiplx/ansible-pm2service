#!/usr/bin/env python

import yaml
import json

from ansible.module_utils.six import iteritems
from ansible.module_utils.six.moves import shlex_quote
from ansible.module_utils.six import text_type
from ansible.module_utils._text import to_bytes

import tempfile
import subprocess
import os

library = "../library/pm2service.js"
testfile = "tests.yml"


doc = yaml.load(open(testfile))

outputs = {}
fd = tempfile.NamedTemporaryFile()

for test in doc :
    testfile = tempfile.NamedTemporaryFile()
    args_data = ""
    for k, v in iteritems(test["module_args"]):
        args_data += '%s=%s ' % (k, shlex_quote(text_type(v)))
    data = to_bytes(args_data, errors='surrogate_or_strict')
    testfile.write(data)
    outputs[test["name"]] = testfile
    fd.write( "node {0} {1} > {1}.stdout 2> {1}.stderr\n".format(os.path.realpath(library), testfile.name) )
    testfile.flush()

fd.flush()
os.system( "bash %s" % fd.name )

for test in doc :
    testfile = outputs[test["name"]].name
    if os.stat("%s.stderr"%testfile).st_size != 0 :
        print( "%s : ERROR, stderr not empty" % test["name"])
    os.unlink("%s.stderr"%testfile)
    output = json.load(open("%s.stdout"%testfile))
    if output.get("failed") :
        print( "%s : ERROR, %s" % ( test["name"] , output.get("msg", "NO ERROR MESSAGE GIVEN")) )
    os.unlink("%s.stdout"%testfile)

