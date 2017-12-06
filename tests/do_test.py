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

library = "library/pm2service.js"
testfile = "tests/tests.yml"


def pm2service ( name ) :
    processes = [ proc["pm2_env"]
        for proc in json.loads( subprocess.check_output(["/usr/bin/pm2", "jlist"]) )
        if proc["name"] == name ]
    if processes :
        return processes[0]
    else :
        return {}

def pm2servicechange ( change , before , after ) :
    if change == '+' :
        return len(before) == 0 and len(after) > 0 and after["status"] == "online"
    elif change == '=' :
        return before["restart_time"] == after["restart_time"] and before["status"] == after["status"]
    elif change == '-' :
        return len(before) > 0 and len(after) == 0
    elif change == '?' :
        return before["status"] == "online" and after["status"] == "stopped"
    elif change == '~' :
        return before["restart_time"] + 1 == after["restart_time"]
    else :
        raise Exception( "Unknown change type '%s'" % change )

ret = 0

doc = filter( lambda t : not t.get("skip", False) , yaml.load(open(testfile)) )

for test in doc :
    testfile = tempfile.NamedTemporaryFile()
    args_data = ""
    for k, v in iteritems(test["module_args"]):
        args_data += '%s=%s ' % (k, shlex_quote(text_type(v)))
    data = to_bytes(args_data, errors='surrogate_or_strict')
    testfile.write(data)
    testfile.flush()
    if test.has_key( "setUp" ) :
        os.system( "%s > /dev/null 2>&1" % test["setUp"] )
    if test.has_key("pm2service") :
        test['before'] = pm2service( test["pm2service"][1:] )
    os.system( "node {0} {1} > {1}.stdout 2> {1}.stderr\n".format(library, testfile.name) )

    if os.stat("%s.stderr"%testfile.name).st_size != 0 :
        print( "%s : ERROR, stderr not empty" % test["name"])
        print( "".join( open("%s.stderr"%testfile.name).readlines() ) )
        ret = 1
    else :
        os.unlink("%s.stderr"%testfile.name)
        output = json.load(open("%s.stdout"%testfile.name))
        if test.has_key("expect_fail") :
            failmsg = test["expect_fail"] or ""
            if output.get("failed") :
                if failmsg.lower() in output.get("msg", "").lower() :
                    print( "%s : OK" % test["name"] )
                    os.unlink("%s.stdout"%testfile.name)
                else :
                    print( "%s : ERROR, '%s' not present in failure message '%s'" % ( test["name"] , failmsg , output.get("msg", "NO ERROR MESSAGE GIVEN") ) )
                    print( "".join( open("%s.stdout"%testfile.name).readlines() ) )
                    ret = 1
            else :
                print( "%s : ERROR, expected failure" % test["name"] )
                print( "".join( open("%s.stdout"%testfile.name).readlines() ) )
                ret = 1
        else :
            if output.get("failed") :
                print( "%s : ERROR, %s" % ( test["name"] , output.get("msg", "NO ERROR MESSAGE GIVEN")) )
                print( "".join( open("%s.stdout"%testfile.name).readlines() ) )
                ret = 1
            else :
                if test.has_key("pm2service") :
                    try :
                        after = pm2service( test["pm2service"][1:] )
                        if pm2servicechange( test["pm2service"][0] , test["before"] , after ) :
                            print( "%s : OK" %  test["name"] )
                            os.unlink("%s.stdout"%testfile.name)
                        else :
                            print( "%s : ERROR, %s" % ( test["name"] , output.get("msg", "Unexpected change in service state")) )
                            print( "".join( open("%s.stdout"%testfile.name).readlines() ) )
                            ret = 1
                    except Exception, ex:
                        print( "%s : EXCEPTION, %s" % ( test["name"] , ex ) )
                        print( "".join( open("%s.stdout"%testfile.name).readlines() ) )
                        ret = 1
                else :
                    print( "%s : OK" %  test["name"] )
                    os.unlink("%s.stdout"%testfile.name)

    if test.has_key( "tearDown" ) :
        os.system( "%s > /dev/null 2>&1" % test["tearDown"] )

os.sys.exit(ret)

