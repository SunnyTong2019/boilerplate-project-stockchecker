/*
*
*
*       FILL IN EACH FUNCTIONAL TEST BELOW COMPLETELY
*       -----[Keep the tests in the same order!]-----
*       (if additional are added, keep them at the very end!)
*/

var chaiHttp = require('chai-http');
var chai = require('chai');
var assert = chai.assert;
var server = require('../server');

chai.use(chaiHttp);



suite('Functional Tests', function() {
    
    suite('GET /api/stock-prices => stockData object', function() {
      
      afterEach(function(done) {
         this.timeout(30000)  // We'll set the timeout for this "test" to 10 seconds longer than our pause length so that our afterEach doesn't risk timing out and failing
         setTimeout(function() {
           console.log("Pause for 20 seconds to not exceed Alpha Vantage's API's limit of 5 requests per minute.");
           done();
         }, 20000);
      });  // END of afterEach() "pauser"
      
      test('1 stock', function(done) {
       chai.request(server)
        .get('/api/stock-prices')
        .query({stock: 'goog'})
        .end(function(err, res){
          assert.equal(res.status, 200);
          assert.equal(res.body.stockData.stock, 'goog');
          assert.property(res.body.stockData, 'price');
          assert.equal(res.body.stockData.likes, 0);
          done();
        });
      });
      
      test('1 stock with like', function(done) {
       chai.request(server)
        .get('/api/stock-prices')
        .query({stock: 'msft', like: true})
        .end(function(err, res){
         assert.equal(res.status, 200);
         assert.equal(res.body.stockData.stock, 'msft');
         assert.property(res.body.stockData, 'price');
         assert.equal(res.body.stockData.likes, 1);
         done();
        });
      });
      
      test('1 stock with like again (ensure likes arent double counted)', function(done) {
        chai.request(server)
        .get('/api/stock-prices')
        .query({stock: 'msft', like: true})
        .end(function(err, res){
         assert.equal(res.status, 200);
         assert.equal(res.body.stockData.stock, 'msft');
         assert.property(res.body.stockData, 'price');
         assert.equal(res.body.stockData.likes, 1);
         done();
        });
      });
      
      test('2 stocks', function(done) {
        chai.request(server)
        .get('/api/stock-prices')
        .query({stock: ['amzn','aapl']})
        .end(function(err, res){
         assert.equal(res.status, 200);
         assert.equal(res.body.stockData[0].stock, 'amzn');
         assert.property(res.body.stockData[0], 'price');
         assert.equal(res.body.stockData[0].rel_likes, 0);
         assert.equal(res.body.stockData[1].stock, 'aapl');
         assert.property(res.body.stockData[1], 'price');
         assert.equal(res.body.stockData[1].rel_likes, 0);
         done();
        });
      });
      
      test('2 stocks with like', function(done) {
        chai.request(server)
        .get('/api/stock-prices')
        .query({stock: ['intu','qcom'], like: true})
        .end(function(err, res){
         assert.equal(res.status, 200);
         assert.equal(res.body.stockData[0].stock, 'intu');
         assert.property(res.body.stockData[0], 'price');
         assert.equal(res.body.stockData[0].rel_likes, 0);
         assert.equal(res.body.stockData[1].stock, 'qcom');
         assert.property(res.body.stockData[1], 'price');
         assert.equal(res.body.stockData[1].rel_likes, 0);
         done();
        });
      });
      
      
      
    });

});
