let assert = require('assert');
const Client = require(__dirname + '/../index');

describe('Basic tests', function() {
  let client;
  before(function (done) {
    client = new Client('localhost');
    done();
  });

  it('init should take less than 2000ms', function(done){
    this.timeout(2000);
    this.slow(2000);
    client.on('warning', (message) => {
      if(message === 'could not connect to hub')
        done();
    })
  });


});