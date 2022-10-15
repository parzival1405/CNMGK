const express = require("express");
const app = express();
const port = 3000;
const path = require("path");
const multer = require("multer");
const AWS = require("aws-sdk");
const {v4:uuid} = require("uuid")
require("dotenv").config();


app.set("views", path.join(__dirname, "./src/views"));
app.set("view engine", "ejs");
const tableName = "HuuSanPham";
const CLOUD_FRONT_URL = 'https://d9eqr85kdk53r.cloudfront.net/'
const S3 = new AWS.S3({
  accessKeyId: process.env.accessKeyId,
  secretAccessKey: process.env.secretAccessKey
})
const config = new AWS.Config({
  accessKeyId: process.env.accessKeyId,
  secretAccessKey: process.env.secretAccessKey,
  region: process.env.region,
});
AWS.config = config;
const docClient = new AWS.DynamoDB.DocumentClient();
const storage = multer.memoryStorage({
  destination(req,file,callback){
    callback(null,'')
  }
})
const checkFileType = (file,cb)=>{
  const fileTypes = /jpeg|jpg|png|gif/

  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = fileTypes.test(file.mimetype);

  console.log(mimetype,extname)

  if(extname && mimetype){
    return cb(null,true)
  }

  return cb("err:image Only")
}

const upload = multer({
  storage,
  limits:{fileSize:2000000},
  fileFilter(req,file,cb){
    checkFileType(file,cb)
  },
});


app.get("/", (req, res) => {
  const params = {
    TableName: tableName,
  };
  docClient.scan(params, (err, data) => {
    if (err) {
      res.send("err");
    } else {
      return res.render("index.ejs", { SanPhams: data.Items });
    }
  });
});

app.post("/", upload.single('image'), (req, res) => {
  const { ma_sp, ten_sp, so_luong } = req.body;
  const image = req.file.originalname.split(".");

  const fileType = image[image.length-1];

  const filePath = `${uuid() + Date.now().toString}.${fileType}`

  const params = {
    Bucket:"uploads3-toturial-bucket-huu",
    Key:filePath,
    Body:req.file.buffer
  }

  S3.upload(params, (err, data) => {
    if (err) {
      return res.send(err);
    } else {
      const newItem = {
        TableName: tableName,
        Item: {
          MaSp: parseInt(ma_sp),
          TenSp: ten_sp,
          SoLuong: parseInt(so_luong),
          Image_URL:`${CLOUD_FRONT_URL}${filePath}`
        },
      };
      docClient.put(newItem, (err, data) => {
        if (err) {
          return res.send(err);
        } else {
          return res.redirect("/");
        }
      });
    }
  })
});

app.get('/product/:id', (req, res) => {
    const MaSp= req.params.id;
    const params = {
        TableName: tableName,
        Key:{
            MaSp:parseInt(MaSp)
        }
      };
      docClient.get(params, (err, data) => {
        if (err) {
          res.send(err);
        } else {
          return res.render("product.ejs", { SanPhams: data.Item });
        }
      });
})

app.post('/update', upload.fields([]), (req, res) => {
    const { ma_sp, ten_sp, so_luong } = req.body;
    const params = {
        TableName: tableName,
        Key: {
            MaSp: parseInt(ma_sp),
        },
        UpdateExpression: "set TenSp = :x, SoLuong = :y",
        
        ExpressionAttributeValues: {
            ":x": ten_sp,
            ":y": parseInt(so_luong)
        }
      };
      docClient.update(params, (err, data) => {
        if (err) {
          res.send(err);
        } else {
            return res.redirect("/");
        }
      });
})

app.post("/delete", upload.fields([]), (req, res) => {
  const listItems = Object.keys(req.body).map(x=>+x);

  if (listItems.length === 0) {
    return res.redirect("/");
  }

  const onDeleteItem = (index) => {
    const params = {
      TableName: tableName,
      Key: {
        MaSp: listItems[index],
      },
    };
    docClient.delete(params, (err, data) => {
      if (err) {
        return res.send(err);
      } else {
        if(index>0){
            onDeleteItem(index-1)
        }else{
            return res.redirect("/");
        }
      }
    });
  };

  onDeleteItem(listItems.length -1)
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
