var chai = require('chai'),
  expect = chai.expect,
  rewire = require('rewire'),
  path = require('path'),
  HttpStatus = require('http-status-codes');

var appHome = path.join(process.cwd());
global.appHome = appHome;
var webhook = rewire(appHome + '/app/webhook.js'),
  fxns = {};
fxns.checkHeaders = webhook.__get__('checkHeaders');
fxns.checkSignature = webhook.__get__('checkSignature');

//Supress logs
var mock_bunyan = {
  info: function(data){
    return data;
  },
  error: function(data){
    return data;
  },
  trace: function(data){
    return data;
  }
};


describe('webhook functions', function(){
  var rewire_rev, rewire_revert;
  beforeEach(function(){
    rewire_rev = webhook.__set__('log', mock_bunyan);
    rewire_revert = () => null;
  });

  afterEach(function(){
    rewire_rev();
    if (rewire_revert) { rewire_revert(); rewire_revert = false;}
  });

    /** /=============================================================\ **
     ** |_-`-_-`-_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`-_| **
     ** \=============================================================/ **/
  describe('checkHeaders() tests', function(){
    it('Should go to the next function on github signature & github event', function(done){
      var mock_next = function(data){
        expect(data).to.equal(undefined);
        done();
      };

      var mock_req = {
        'get': function(){
          return 'ok';
        }
      };
      fxns.checkHeaders(mock_req, null, mock_next);
    });

    it('Should return BAD REQUEST status code function when no signature sent', function(done){
      var response = {
        'status': function(data){
          expect(data).to.equal(HttpStatus.BAD_REQUEST);
          return {
            'send': function(data){
              expect(data).to.equal('Some headers missing');
              done();
            }
          };
        }
      };
      var signature = 'sig';

      var mock_req = {
        'get': function(data){
          if(data == 'X-GitHub-Event'){
            return 'sha1=' + signature;
          }else{
            return undefined;
          }
        }
      };

      fxns.checkHeaders(mock_req, response, null);
    });

    it('Should return BAD REQUEST status code function when no github event sent', function(done){
      var response = {
        'status': function(data){
          expect(data).to.equal(HttpStatus.BAD_REQUEST);
          return {
            'send': function(data){
              expect(data).to.equal('Some headers missing');
              done();
            }
          };
        }
      };

      var signature = 'sig';

      var mock_req = {
        'get': function(data){
          if(data == 'X-Hub-Signature'){
            return 'sha1=' + signature;
          }else{
            return undefined;
          }
        }
      };

      fxns.checkHeaders(mock_req, response, null);
    });
  });

    /** /=============================================================\ **
     ** |_-`-_-`-_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`_-`-_| **
     ** \=============================================================/ **/
  describe('checkSignature() tests', function(){
    it('Should return BAD REQUEST status', function(done){
      var response = {
        'status': function(data){
          expect(data).to.equal(HttpStatus.BAD_REQUEST);
          return {
            'send': function(data){
              expect(data).to.equal('Invalid Signature');
              done();
            }
          };
        }
      };

      var signature = 'sig';

      var mock_req = {
        'get': function(){
          return 'sha1=' + signature;
        }
      };

      var mock_crypt = {
        'createHash': function(){
          return {
            update: function(){
              return signature;
            }
          };
        }
      };


      rewire_revert = webhook.__set__('crypto', mock_crypt);
      fxns.checkSignature(mock_req, response, null);
    });


    it('Should go to the next function', function(done){
      var mock_next = function(data){
        expect(data).to.equal(undefined);
        done();
      };

      var signature = 'sig';
      var other_signature = 'not_sig';

      var mock_req = {
        'get': function(){
          return 'sha1=' + signature;
        }
      };

      var mock_crypt = {
        'createHash': function(){
          return {
            update: function(){
              return other_signature;
            }
          };
        }
      };
      rewire_revert = webhook.__set__('crypto', mock_crypt);
      fxns.checkSignature(mock_req, null, mock_next);
    });
  });

});
