
var crypto = require('crypto');
var bodyParser = require('body-parser');
var bunyan = require('bunyan');
var log = bunyan.createLogger({
  level: 'trace',
  name: 'release2conductor-webhook'
});
var express = require('express');
var HttpStatus = require('http-status-codes');

var triggerConductor = require('./modules/triggerConductor.js');


function HttpResponse(status, message) {
  this.status = status;
  this.message = message;
}
HttpResponse.prototype.send = function(rsp) {
  log.trace({httpResponse: this}, 'sending response');
  return rsp.status(this.status).send(this.message);
};


function checkHeaders(req, res, next) {
  log.trace('checkHeaders');
  if ((req.get('X-Hub-Signature') === undefined) || (req.get('X-GitHub-Event') === undefined)) {
    return res.status(HttpStatus.BAD_REQUEST).send('Some headers missing');
  }
  return next();
}

function checkSignature(req, res, next) {
  log.trace('checkSignature');
  if (req.get('X-Hub-Signature') === ('sha1=' + crypto.createHash('sha1').update(process.env.WEBHOOK_KEY))) {
    return res.status(HttpStatus.BAD_REQUEST).send('Invalid Signature');
  }
  return next();
}

function ping(req, res){
  log.info('Respond 200 to ping' );
  var httpResponse = new HttpResponse(HttpStatus.OK, 'pong');
  return httpResponse.send(res);
}

function release(req, res){
  log.trace('release-->');
  log.info('Handle release' );
  log.trace('req.query==', req.query);
  // var ENV = process.env;
  // var workflow_name = ENV.WORKFLOW_NAME;
  // var task_name = ENV.TASK_NAME;
  // var output_json = {
  //   release_url: ENV.RELEASE_URL
  // };
  var httpResponse = new HttpResponse(HttpStatus.OK, '');
  if(req.body.action === 'published' && req.body.release) {
    var release = req.body.release;
    var repo = req.body.repository.name;

    log.trace(release);
    if (!release.prerelease){
      log.info('trigger conductor workflow');
      var url = release.assets[0].browser_download_url;
      var options = {
        workflow_name: req.query.workflow_name,
        task_name: req.query.task_name,
        release_url: url,
        repo: repo,
        conductor_api: req.query.conductor_api
      };
      triggerConductor(options);
    }
  } else {
    log.error('Github release event with action !== published');
  }
  log.trace('<--release');
  return httpResponse.send(res);
}

function handleGithubWebhook(req, res, next) {
  log.trace('handleGithubWebhook', req.get('X-GitHub-Event'));
  switch(req.get('X-GitHub-Event')) {
    case 'ping':
      ping(req,res);
      break;
    case 'release':
      release(req, res, next);
      break;
    default:
      //Ignore all other
      break;
  }
}

module.exports = (function() {
  var router = express.Router();
  router.use(bodyParser.json()); //JSON parsing for handling data
  router.use(bodyParser.urlencoded({
    extended: true
  }));
  router.post('/', checkHeaders, checkSignature, handleGithubWebhook);
  return router;
})();
