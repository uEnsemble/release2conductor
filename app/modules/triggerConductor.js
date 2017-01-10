var request = require('request');
var async = require('async');
var HttpStatus = require('http-status-codes');
var bunyan = require('bunyan');
var log = bunyan.createLogger({
  level: 'trace',
  name: 'release2conductor-webhook'
});

const HEADERS = {
  'headers': {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

const ConductorDefaults = {
  conductor_api : process.env.CONDUCTOR_API,
};


module.exports = function(options) {
  var opts = Object.assign({}, ConductorDefaults, options);
  var output_json = {
    release_url: opts.release_url
  };
  delete opts.release_url;
  // console.log("output_json");
  // console.dir(output_json);

  //Run the tasks in a waterfall
  log.trace('conduct ', opts);
  async.waterfall([
    workflowRunning,
    startWorkflow,
    pollForWorkflow,
    checkTask,
    completeTask
  ],function(err, data){
    if(err){
      log.error('This stuff went bad: '  + err);
    }else{
      log.trace(data);
      log.info('It\'s all gravy');
    }
  });

  //Should check with queue endpoint, but this ensures we don't miss it if it is acked
  function workflowRunning(callback){
    log.trace('Check workflow ' + opts.conductor_api + '/workflow/running/' + opts.workflow_name);
    request.get(opts.conductor_api + '/workflow/running/' + opts.workflow_name, HEADERS, (req, res) => {
      var exists;
      if(res.statusCode != HttpStatus.OK){
        return callback('Error in workflowRunning: ' + res.body);
      }
      exists = JSON.parse(res.body).length > 0;
      callback(null, exists);
    });
  }

  //start the workflow if not already started
  function startWorkflow(exists, callback){
    if(exists){
      log.info('Workflow exists');
      callback(null, false);
    }else{

      //hack to copy value not reference
      var header = JSON.parse(JSON.stringify(HEADERS));
      header.headers['Accept'] = 'text/plain';
      header['json'] = {};

      request.post(opts.conductor_api + '/workflow/' + opts.workflow_name , header, (req, res) => {
        if(res.statusCode != HttpStatus.OK){
          return callback('Error in startWorkflow: ' + res.body);
        }
        log.trace('Started workflow: ' + res.body);
        callback(null, res.body);
      });
    }
  }


  //TODO: Set max depth to recurse
  function poll(workflow_id, callback){
    request.get(opts.conductor_api + '/workflow/' + workflow_id, HEADERS, (req, res) => {
      log.trace('Polling for: ' + workflow_id + ' status: ' + res.statusCode);
      if(res.statusCode != 200){
        poll(workflow_id, callback);
      }else{
        return callback();
      }
    });
  }

  //poll for workflow if we have an id
  function pollForWorkflow(workflow_id, callback){
    if(workflow_id){
      poll(workflow_id, callback);
    }else{
      return callback();
    }
  }

  //Check for in progress task
  function checkTask(callback){
    //ask for in progress task in case the task is acked (ignore acks)
    request.get(opts.conductor_api + '/tasks/in_progress/' + opts.task_name, HEADERS, (req, res) => {
      var data, taskId, workflowId;
      if(res.statusCode != 200){
        return callback('Error in checkTask: ' + res.body);
      }

      data = JSON.parse(res.body)[0];
      if(data){
        taskId = data.taskId;
        workflowId = data.workflowInstanceId;
      }
      callback(null, taskId, workflowId);
    });
  }

  //Set the task to completed
  function completeTask(task_id, workflow_id, callback){
    log.trace(task_id + ' ' + workflow_id);
    if(task_id && workflow_id){

      //hack to copy by value
      var header = JSON.parse(JSON.stringify(HEADERS));
      header['json'] = {
        'taskId': task_id,
        'workflowInstanceId': workflow_id,
        'status': 'COMPLETED',
        'outputData': output_json
      };

      request.post(opts.conductor_api + '/tasks', header, (req, res) => {
        if(res.statusCode != 204){
          return callback('Error in completeTask: ' + res.body);
        }
        callback(null, 'my grim task is done');
      });
    }else{
      callback(null, 'no task found');
    }
  }

};
