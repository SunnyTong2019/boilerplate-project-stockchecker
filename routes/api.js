/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb');
var request = require('request');
var Promise = require("bluebird");
var requestPromise = require('request-promise');

const CONNECTION_STRING = process.env.DB; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});

module.exports = function (app) {
  
  MongoClient.connect(CONNECTION_STRING, function(err, db) {
   
   if (err) console.log(err);
    
   app.route('/api/stock-prices')
      .get(function (req, res){

var ip = req.ip;
    
// * one stock is passed 
if (! Array.isArray(req.query.stock))      
{      
  var stock = req.query.stock;
  request('https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=' + stock + '&apikey=' + process.env.apikey, 
      function (error, response, body) { 
        if (error) console.log(error);
        var price = JSON.parse(body)['Global Quote']['05. price']; //here use JSON.parse() to convert body which is string to JSON
          
        if (!JSON.parse(body)['Global Quote'].hasOwnProperty('05. price')) // ** if stock is invalid
        { res.json("Please enter valid Nasdaq stock."); }
        else // ** if stock is valid
        {
          if (req.query.like) // *** if "Like?" checkbox is checked
          { 
             db.collection("stock").findOne({stock: stock}, function(err, result) {
                if (err) console.log(err);
                if (result) // **** found in db, then check ip to see if need update 
                {                
                  var ipList = result.ip_list;
                  
                  if (!ipList.includes(ip)) // ***** if ip is not in the ip_list array
                  { 
                    // here use "findOneAndUpdate" not "updateOne" because result returned from "updateOne" doens't have the updated document
                    db.collection("stock").findOneAndUpdate(
                       {stock: stock}, 
                       {
                         $inc: {likes: 1}, // increase likes by 1
                         $push: {ip_list: ip} // add ip to the array list
                       }, 
                       {returnOriginal: false, upsert: true}, 
                       function(err, r) {
                         if (err) console.log(err);
                         res.json({"stockData":{"stock":stock,"price":price,"likes":r.value.likes}});
                     });
                   }
                   else  // ***** if ip is already in the ip_list array
                   { res.json({"stockData":{"stock":stock,"price":price,"likes":result.likes}});}
                 }
                 else // **** not found in db, then insert
                 {
                    db.collection("stock").insertOne(
                       {stock: stock, likes: 1, ip_list: [ip]}, 
                       function(err, r) {
                       if (err) console.log(err);
                       res.json({"stockData":{"stock":stock,"price":price,"likes":r.ops[0].likes}});
                    });
                 }  
             });
          }
          else // *** if "Like?" checkbox is Unchecked
          {
             db.collection("stock").findOne({stock: stock}, function(err, result) {
                if (err) console.log(err);
                if (!result) // **** not found in db, then insert
                {                 
                  db.collection("stock").insertOne(
                     {stock: stock, likes: 0, ip_list: []}, 
                     function(err, r) {
                       if (err) console.log(err);
                       res.json({"stockData":{"stock":stock,"price":price,"likes":0}});                      
                  });
                }
                else // **** found in db, nothing to update, just return result
                { res.json({"stockData":{"stock":stock,"price":price,"likes":result.likes}}); }
               });
           } 
         }
       });
}

// * two stocks are passed
else
{
  var stock1 = req.query.stock[0];
  var stock2 = req.query.stock[1];
  var urls = ['https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=' + stock1 + '&apikey=' + process.env.apikey, 
              'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=' + stock2 + '&apikey=' + process.env.apikey,];

  var requests = [{url: urls[0]}, {url: urls[1]}];

  Promise.map(requests, function(obj) {
     return requestPromise(obj).then(function(body) { return JSON.parse(body)['Global Quote']['05. price']; }); 
  }) // use map method to send out request for each url
  .then(function(results) {
    // results is an array which contains stock price from two requests
    if (results[0]==undefined || results[1]==undefined) // ** if either stock is invalid
    { res.json("Please enter valid Nasdaq stock."); }
    else // ** if both stocks are valid
    { 
      if (!req.query.like) // *** if "Like both?" checkbox is Unchecked
      {
        // search both stocks in db to get the value of their likes
        db.collection("stock").find({stock: { $in: [stock1, stock2]}}).toArray(function (err, doc) {
          if (err) console.log(err);
          var like1,like2;  // store the value of likes for each stock
          
          // doc is an array which contains searched stock documents
          if (doc.length==2) // **** if both stocks are found in db
          { 
            if(doc[0].stock==stock1)
            {
              like1 = doc[0].likes;
              like2 = doc[1].likes;
            }
            else
            {
              like1 = doc[1].likes;
              like2 = doc[0].likes;
            }
            res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": like1-like2},{"stock":stock2,"price":results[1],"rel_likes":like2-like1}]});
           }
           else if (doc.length==1) // **** if one stock is found in db, the other stock is new
           { 
             if(doc[0].stock==stock1) // ***** if the first stock is found in db, the second stock is new
             {
               // insert the second stock to db
               db.collection("stock").insertOne(
                  {stock: stock2, likes: 0, ip_list: []}, 
                  function(err, r) {
                    if (err) console.log(err);
                    like1 = doc[0].likes;
                    like2 = 0;
                    res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": like1-like2},{"stock":stock2,"price":results[1],"rel_likes":like2-like1}]});
                });
              }
              else // ***** if the second stock is found in db, the first stock is new
              {
                // insert the first stock to db
                db.collection("stock").insertOne(
                  {stock: stock1, likes: 0, ip_list: []}, 
                  function(err, r) {
                    if (err) console.log(err);
                    like1 = 0;
                    like2 = doc[0].likes;
                    res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": like1-like2},{"stock":stock2,"price":results[1],"rel_likes":like2-like1}]});
                });
               }
           } 
           else // **** if no stocks are found in db, both stocks are new
           {  
             // insert both stocks to db
             db.collection("stock").insertMany(
               [{stock: stock1, likes: 0, ip_list: []}, 
                {stock: stock2, likes: 0, ip_list: []}], 
               function(err, r) {
                 if (err) console.log(err);
             });
             // like1=like2=0
             res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": 0},{"stock":stock2,"price":results[1],"rel_likes":0}]});
           }
        });   
      }
      else // *** if "Like both?" checkbox is checked
      {
        db.collection("stock").find({stock: { $in: [stock1, stock2]}}).toArray(function (err, doc) {
           if (err) console.log(err);
           var like1,like2; 
           var ipList1, ipList2; // store the array of ip_list for each stock
           var bulk = db.collection("stock").initializeUnorderedBulkOp();
          
           if (doc.length==2) // **** if both stocks are found in db
           {        
             if(doc[0].stock==stock1) // ***** if first stock in search results is stock1
             {
               like1 = doc[0].likes;  // original value before update
               like2 = doc[1].likes;  // original value before update
               ipList1 = doc[0].ip_list;
               ipList2 = doc[1].ip_list;
                  
               if (!ipList1.includes(ip) && !ipList2.includes(ip)) // ****** if both don't have the ip, means both need update
               {
                 // update for both existing stocks
                 bulk.find({stock:stock1}).upsert().updateOne({$inc: {likes: 1}, $push: {ip_list: ip} });
                 bulk.find({stock:stock2}).upsert().updateOne({$inc: {likes: 1}, $push: {ip_list: ip} });
                 
                 // handle the bulk results
                 bulk.execute(function(err, r) {
                   if(err) console.log(err);
                 });
                 
                 res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": like1-like2}, {"stock":stock2,"price":results[1],"rel_likes":like2-like1}]});
                }  
                else if (!ipList1.includes(ip) && ipList2.includes(ip)) // ****** if the first stock needs update
                { 
                  db.collection("stock").findOneAndUpdate(
                    {stock: stock1}, 
                    {
                     $inc: {likes: 1}, 
                     $push: {ip_list: ip} 
                    }, 
                    {returnOriginal: false, upsert: true}, 
                    function(err, r) {
                      if (err) console.log(err);
                      like1 = r.value.likes;
                      res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": like1-like2}, {"stock":stock2,"price":results[1],"rel_likes":like2-like1}]});
                    });
                  }
                  else if (ipList1.includes(ip) && !ipList2.includes(ip)) // ****** if the second stock needs update
                  { 
                    db.collection("stock").findOneAndUpdate(
                       {stock: stock2}, 
                       {
                         $inc: {likes: 1}, 
                         $push: {ip_list: ip} 
                       }, 
                       {returnOriginal: false, upsert: true}, 
                       function(err, r) {
                         if (err) console.log(err); 
                         like2 = r.value.likes;
                         res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": like1-like2}, {"stock":stock2,"price":results[1],"rel_likes":like2-like1}]});
                     });
                   }
                   else // ****** if no stock needs update
                   { res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": like1-like2}, {"stock":stock2,"price":results[1],"rel_likes":like2-like1}]});}
             }
             else // ***** if first stock in search results is stock2 
             {
               like1 = doc[1].likes;
               like2 = doc[0].likes;
               ipList1 = doc[1].ip_list;
               ipList2 = doc[0].ip_list;
                  
               if (!ipList1.includes(ip) && !ipList2.includes(ip)) // ****** if both don't have the ip, means both need update
               {
                 bulk.find({stock:stock1}).upsert().updateOne({$inc: {likes: 1},$push: {ip_list: ip} });
                 bulk.find({stock:stock2}).upsert().updateOne({$inc: {likes: 1},$push: {ip_list: ip} });
                
                 bulk.execute(function(err, r) {
                   if(err) console.log(err);
                 });
                 
                 res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": like1-like2}, {"stock":stock2,"price":results[1],"rel_likes":like2-like1}]});
                }  
                else if (!ipList1.includes(ip) && ipList2.includes(ip)) // ****** if the first stock needs update
                { 
                  db.collection("stock").findOneAndUpdate(
                    {stock: stock1}, 
                    {
                     $inc: {likes: 1}, 
                     $push: {ip_list: ip} 
                    }, 
                    {returnOriginal: false, upsert: true}, 
                    function(err, r) {
                      if (err) console.log(err);
                      like1 = r.value.likes;
                      res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": like1-like2}, {"stock":stock2,"price":results[1],"rel_likes":like2-like1}]});
                    });
                  }
                  else if (ipList1.includes(ip) && !ipList2.includes(ip)) // ****** if the second stock needs update
                  { 
                    db.collection("stock").findOneAndUpdate(
                       {stock: stock2}, 
                       {
                         $inc: {likes: 1}, 
                         $push: {ip_list: ip} 
                       }, 
                       {returnOriginal: false, upsert: true}, 
                       function(err, r) {
                         if (err) console.log(err); 
                         like2 = r.value.likes;
                         res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": like1-like2}, {"stock":stock2,"price":results[1],"rel_likes":like2-like1}]});
                     });
                   }
                   else  // ****** if no stock needs update
                   { res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": like1-like2}, {"stock":stock2,"price":results[1],"rel_likes":like2-like1}]});}
             }
           }
            else if (doc.length==1) // **** if one stock is found in db, the other stock is new
            {  
              if(doc[0].stock==stock1) // ***** if the first stock is found in db, the second stock is new
              {
                // insert new stock which is the second one
                db.collection("stock").insertOne(
                       {stock: stock2, likes: 1, ip_list: [ip]}, 
                       function(err, r) {
                       if (err) console.log(err);
                    });

                like1 = doc[0].likes; 
                like2 = 1;
                ipList1 = doc[0].ip_list;
                
                // update for existing stock which is the first one if ip is not in the ip_list array
                if (!ipList1.includes(ip)) 
                { 
                    db.collection("stock").findOneAndUpdate(
                       {stock: stock1}, 
                       {
                         $inc: {likes: 1}, 
                         $push: {ip_list: ip} 
                       }, 
                       {returnOriginal: false, upsert: true}, 
                       function(err, r) {
                         if (err) console.log(err);
                         like1 = r.value.likes;
                         res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": like1-like2},{"stock":stock2,"price":results[1],"rel_likes":like2-like1}]});
                     });
                  }
                  else 
                  { 
                  res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": like1-like2},{"stock":stock2,"price":results[1],"rel_likes":like2-like1}]});
                  }
              }
               else  // ***** if the second stock is found in db, the first stock is new
               {
                 // insert new stock which is the first one
                 db.collection("stock").insertOne(
                       {stock: stock1, likes: 1, ip_list: [ip]}, 
                       function(err, r) {
                       if (err) console.log(err);
                });

                like1 = 1;
                like2 = doc[0].likes; 
                ipList2 = doc[0].ip_list;
                
                // update for existing stock which is the second one if ip is not in the ip_list array
                if (!ipList2.includes(ip)) 
                { 
                    db.collection("stock").findOneAndUpdate(
                       {stock: stock2}, 
                       {
                         $inc: {likes: 1}, 
                         $push: {ip_list: ip} 
                       }, 
                       {returnOriginal: false, upsert: true}, 
                       function(err, r) {
                         if (err) console.log(err);
                         like2 = r.value.likes;
                         res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": like1-like2},{"stock":stock2,"price":results[1],"rel_likes":like2-like1}]});
                     });
                  }
                  else 
                  { 
                  res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": like1-like2},{"stock":stock2,"price":results[1],"rel_likes":like2-like1}]});
                  }
                }
            }
            else // **** if no stocks are found in db, both stocks are new
            {
               db.collection("stock").insertMany(
                  [{stock: stock1, likes: 1, ip_list: [ip]}, 
                   {stock: stock2, likes: 1, ip_list: [ip]}], 
                  function(err, r) {
                    if (err) console.log(err);
               });
               // like1=like2=1
               res.json({"stockData":[{"stock":stock1,"price":results[0],"rel_likes": 0},{"stock":stock2,"price":results[1],"rel_likes":0}]});
             }
        });   
      }
    }
  }, 
  function(err) {
  // handle all errors here, errors from two requests using map method
  if (err) console.log(err);
});
}   
     
    })
 
   //404 Not Found Middleware
   app.use(function(req, res, next) {
         res.status(404)
            .type('text')
            .send('Not Found');
   });
    
 });
};

