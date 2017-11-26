#!/usr/bin/env node

// API documentation : http://pm2.keymetrics.io/docs/usage/pm2-api

var pm2 = require('pm2');


// Parse input arguments

var ansible_opts = {};
var module_args = {};

for (var i = 2; i < process.argv.length; i+=2) {
  var key = process.argv[i];
  key.startsWith("_ansible_") ? ansible_opts[key.substring(9)] = process.argv[i+1] : module_args[key] = process.argv[i+1];
  }


// Verify required arguments

if ( ! module_args.name ) {
  console.log(JSON.stringify({"failed": true, "msg": "Missing required argument 'name'"}));
  process.exit(1);
  }


// Get running processes

function parseProcess(name, env){
  return { "name": name,
           "status": env.status,
           "cwd": env.pm_cwd || env.cwd,
           "interpreter": env.exec_interpreter || env.interpreter,
           "interpreterArgs": env.node_args || env.interpreter_args,
           "script": env.pm_exec_path || env.script,
           "args": env.args
           };
  }


var pm2 = require('pm2');

pm2.connect(true, function(err) {
  if (err) {
    console.log(JSON.stringify({"failed": true, "msg": "pm2 error : " + err}));
    pm2.disconnect();
    process.exit(2);
    }

  var services = [];

  pm2.list(function(err, processDescriptionList){
    if (err) {
      console.log(JSON.stringify({"failed": true, "msg": "pm2 error : " + err}));
      pm2.disconnect();
      process.exit(2);
      }
    processDescriptionList.forEach(function(process){
      services.push(parseProcess(process.name, process.pm2_env));
      });
    pm2.disconnect();

    var service = services.filter(function(item){return item.name===module_args.name})[0];

    if ( service === undefined ) {
      // The only secure way to ensure sequential execution seems to enclose connects within connect within connects ...
      pm2.connect(true, function(err) {
        if (err) {
          console.log(JSON.stringify({"failed": true, "msg": "pm2 error : " + err}));
          pm2.disconnect();
          process.exit(2);
          }
        service = parseProcess(module_args.name, module_args);
        pm2.start(service, function(err, services) {
          if (err) {
            console.log(JSON.stringify({"failed": true, "msg": "pm2 error : " + err}));
            pm2.disconnect();
            process.exit(2);
            }
          var service = parseProcess(services[0].pm2_env.name, services[0].pm2_env);
          console.log(JSON.stringify({"changed": true, "changes": service}));
          pm2.disconnect();
          });
        });
    } else {
      var result = { "changed": false };

      var changes = Object.keys(module_args).filter(function(name){
        return module_args[name]!=service[name];
      }).reduce(function(result,name){
        ["interpreterArgs", "args"].includes(name)
          ? service[name] = module_args[name].split(" ")
          : service[name] = module_args[name];
        result[name] = module_args[name];
        return result;
        },{});

      if ( Object.keys(changes).length != 0 ) {
        result.changed = true;
        result.changes = changes;
        pm2.connect(true, function(err) {
          if (err) {
            console.log(JSON.stringify({"failed": true, "msg": "pm2 error : " + err}));
            pm2.disconnect();
            process.exit(2);
            }

          pm2.restart(service, function(err, services) {
            if (err) {
              console.log(JSON.stringify({"failed": true, "msg": "pm2 error : " + err, "otros": apps}));
              pm2.disconnect();
              process.exit(2);
              }
            var service = parseProcess(services[0].pm2_env.name, services[0].pm2_env);
            console.log(JSON.stringify({"CHANGED": true, "changes": service}));
            console.log(JSON.stringify(result));
            pm2.disconnect();
            });
          });
        }
      }

    });
  });

