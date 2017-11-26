#!/usr/bin/env nodejs

var http = require('http');

function serve(ip, port)
{
     http.createServer(function (req, res) {
        res.writeHead(200, {'Content-Type': 'text/plain'}); // Return a 200 response
        res.write(JSON.stringify(req.headers));             // Respond with request headers
        res.end("\nServer Address: "+ip+":"+port+"\n");     // Let us know the server that responded
    }).listen(port, ip);
    console.log('Server running at http://'+ip+':'+port+'/');
}

serve('0.0.0.0', 9000);
