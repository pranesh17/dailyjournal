//jshint esversion:6
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require("lodash");
const mysql = require('mysql');
const fileUpload = require('express-fileupload');
const AWS = require('aws-sdk');
require('dotenv').config()

const s3 = new AWS.S3( );
//adding configure here ??
//AWS.config.update({region: 'us-west-2'});  https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-shared.html

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(fileUpload({
    createParentPath: true
}));

var connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: process.env.PASSWORD,
});

connection.connect(function(err) {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }
  console.log('Connected to RDS.');
});
connection.query("use diary;", function(err, result , fields) {
  if (err) throw err;
});


var userid=1;  //for storing userid and name of current user
var name=0;

app.get("/", (req,res)=>{
  res.render("landing");
});
app.get("/logout", (req,res)=>{
  var userid=1;
  res.render("landing");
});

app.get("/register", (req,res)=>{
  res.render("register");
});

app.post("/register", (req, res) => {
  var Email = req.body.email;
  var Name = req.body.name;
  var password = req.body.password;
  var sql = "INSERT INTO users (Email, Name, Password ) VALUES('"+Email+"','"+Name+"','"+ password+"');"
  console.log(sql);
  connection.query(sql, function(err, result) {
   if (err){
     throw err;
     res.render("error", {
       Error: "Registration error",
       });
   }
   else
   {
     res.render("registerresponce");
    }
  });
});

app.get("/login", (req,res)=>{
  res.render("login");
});

app.post("/login", (req, res) => {
  var Email = req.body.email;
  var password = req.body.password;
  var sql= "select * from users where email='"+Email+"';"
  connection.query(sql, function(err, result) {
    if (err) {
        throw err;
        console.log(err);
    }
    else{
      if(password == result[0].Password){
        userid=result[0].UserID;
        name=result[0].Name;
        res.redirect("/home");
      }
      else{
         res.render("error", {
           Error: "login failure",
           });
      }
    }
  });

});

app.get("/home", function(req, res){
  connection.query("select * from posts where userid="+userid+";", function(err, result) {
   if (err){
     throw err;
     res.render("error", {
       Error: "Fetching error",
       });
   }
   else
   {
     res.render("home", {
       Name: name,
       posts: result
       });
    }
  });
});


app.get("/write", function(req, res){
  res.render("write");
});

app.post("/write", function(req, res){
  var title = req.body.postTitle;
  var content = req.body.postBody;
  var photo = req.files.photo;
  //writing photo to s3
  var bucketname="dailyjournal123"; //name of the buckets
  var photoname=title+".jpg";   //can postid be used
  var data=photo.data;
  const params = {
    Bucket: bucketname, //  bucket name
    Key: photoname, // file will be saved as
    Body: data,
    ACL: 'public-read'
      };
    s3.upload(params, function(s3Err, data) {
       if (s3Err){
          throw s3Err;
          res.render("error", {
            Error: "Uploading image to s3 error",
            });
        }
      console.log(`File uploaded successfully at ${data.Location}`)
    });

    var piclink="https://"+bucketname+".s3.amazonaws.com/"+photoname+"";

  //writing to rds
  var sql = "INSERT INTO posts(Title, Piclink, content , userid ) VALUES('"+title+"','"+piclink+"','"+content+"',"+userid+");"
  console.log(sql);
  connection.query(sql, function(err, result) {
      if (err){
         throw err;
         res.render("error", {
           Error: "Sql insertion error",
           });
        }
      else
        {
           res.redirect("/home");
         }
   });

});


app.get("/day/:id", function(req, res){
  connection.query("select * from posts where postid="+req.params.id+";", function(err, result) {
   if (err){
     throw err;
     res.render("error", {
       Error: "Loading page error",
       });
   }
   else
   {
     res.render("day", {
       title: result[0].Title,
       content:result[0].content,
       piclink:result[0].Piclink
     });
    }
  });
});


app.listen(3000, function() {
  console.log("Server started on port 3000");
});