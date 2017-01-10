//Required dependencies
var express = require('express');
var bunyan = require('bunyan');
var moment = require('moment');
var log = bunyan.createLogger({
  level: 'trace',
  name: 'release2conductor-webhook'
});
var cfenv = require('cfenv');
var appEnv = cfenv.getAppEnv();

var webhookRoute = require('./webhook.js');

var serverStartTime = moment();
var PORT = appEnv.port || 3003;
if(!appEnv.WEBHOOK_KEY)
  appEnv.WEBHOOK_KEY = 'abcdefg';

//Create express server & socket.io
var app = express();
//app.use(require('express-bunyan-logger')());

function startServer(err) {
  log.trace('Setup express.');
  if(err) {
    log.error(err);
  } else {
    app.use('/webhook', webhookRoute);
    app.get('/', function (req, res) {
      res.send('Server uptime: ' + moment.duration(moment().diff(serverStartTime)).humanize());
    });
    app.listen(PORT, '0.0.0.0', function () { //Start Express Server
      log.info('Webhook listening on port ' + PORT);
    });
  }
}

startServer();
