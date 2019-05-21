'use strict';

const http = require('http'),
    url = require("url"),
    dns = require("dns"),
    qs = require("querystring"),
    mongoose = require('mongoose');





/***************************** DB sETUP AND INIT *******************************/

mongoose.connect("mongodb://admin:Sh0rt!!!@ds159216.mlab.com:59216/urlshortener", {useNewUrlParser: true}, err => {
  if (err) {
    console.log('Unable to connect to the server. Please start the server. Error:', err);
  }
});


const db = mongoose.connection;

// disconnects on error in order to force an auto reconnect
db.on('error', error => {
  console.error('Error in MongoDb connection: ' + error);
  mongoose.disconnect();
});


// Creating the url shema and model
let urlSchema = new mongoose.Schema({
  original_url: {
        type:String,
        required: true,
        unique: true
    },
  short_url: {
        type:Number,
        required: true,
        unique: true
    }
});

let urlModel = mongoose.model('urlModel', urlSchema);

// Initialising the amount of documents in the DB
let entries = 0;
urlModel.countDocuments( (err, num) => {entries = num; });





/*************************** STATIC PAGE ******************************************/

const page = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>URL shortener</title>
  </head>

  <body>
    <h1>URL Shortener</h1>
    <form method="post" action="/api/shorturl/new">
      <p>
        <label for="myurl">Type a URL to shorten</label>
        <input type ="url" name="myurl" id="myurl" required>
      </p>
      <input type="submit" name="submit" value ="POST URL">
    </form>
  </body>
</html>`;





/********************** SERVER SETUP *******************************/

let httpserver = http.createServer();
httpserver.on('request', (req, res) => {

  let path = url.parse(req.url, true).path;

  // Deals with POST data
  if (req.method === "POST" && path == "/api/shorturl/new") {
    let shorturl = {}, // object to be returned as JSON and eventually sent to DB
        body = '', // body of the POST request
        myurl = ''; // URL sent in the body of the request

    req.on('data', data => {
      body += data;
    });

    req.on('end', () => {
      myurl = qs.parse(body).myurl;
      let hostname = myurl.replace(/(^\w+:|^)\/\//, ''); // hostname used only to test the DNS
      res.setHeader('Content-Type', 'application/json');

      dns.lookup(hostname, err => {
        if (err) {
          shorturl.error = "Invalid URL";
          res.end(JSON.stringify(shorturl));
        } else {
          // Checks that there is no DBentry with that URL before adding data to the DB
          // If an entry already exists, we return that entry to the user
          urlModel.find({original_url: myurl}, (err, docs) => {
            if (err){
              console.log(err);
            } else if (docs.length !== 0) {
              shorturl = {
                original_url: docs[0]["original_url"],
                short_url: docs[0]["short_url"]
              }
            } else {
              shorturl = {
                original_url: myurl,
                short_url: ++entries
              }
              let newUrl = new urlModel(shorturl);
              newUrl.save((err, newUrl) => {
                if (err) {console.log(err);}
              })
            }
            res.end(JSON.stringify(shorturl));
          });

        }

      });
    });

  // Dealing with GET data
  } else {
    let index = path.lastIndexOf("/") + 1;

    // opens the basic page if the route is not /api/shorturl/
    if (path.substring(0, index) !== "/api/shorturl/") {
      res.setHeader('Content-Type', 'text/html');
      res.end(page);

    // redirects to the
    } else {
      urlModel.find({short_url: path.substring(index)}, (err, doc) => {
        if (err) { console.log(err); }
        if (doc.length === 0) {
          res.setHeader('Content-Type', 'text/html');
          res.end(page);
        } else {
        let shorturl = doc[0]["original_url"];
          res.writeHead(301,
            {Location: shorturl}
          );
          res.end();
        }
      });
    }

  }
});



let port = process.env.PORT || 3000;

httpserver.listen(port, function() {
  console.log('Listening on ' + port);
});
