const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: [
    'https://car-doctor-472da.web.app',
    'http://localhost:5173'
  ],
  credentials: true, 
}))
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9jtha6u.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// user defined middleware
const verifyToken = async(req, res, next) => {
  const token = req.cookies?.token;
  if(!token){
    return res.status(401).send({message: 'unauthorized access'});
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if(err){
      return res.status(401).send({message: 'unauthorized access'});
    }
    req.user = decoded;
    next();
  })
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    // Auth related api
    app.post('/jwt', async(req, res) =>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
      res.cookie('token', token, {
        httpOnly: true, 
        secure: true,
        sameSite: 'none'
      })
      .send({checkingtoken: token});
    })

    app.post('/logout', async(req, res) =>{
      const user = req.body;
      res.clearCookie('token', {maxAge: 0}).send({success: true});
    })

    // service related api
    const database = client.db('car-doctor');
    const servicesCollection = database.collection('services');
    const bookingCollection = database.collection('bookings');

    app.get('/services', async(req, res) =>{
      const services = await servicesCollection.find().toArray();
      const sortedServices = services.map(service => (
        //extract all properties of service then create new object and convert price to integer
        {...service, price: parseInt(service.price)} 
      ))
      .sort((a, b) => req.query.sort === 'asc'? a.price - b.price : b.price - a.price);
      res.send(sortedServices);
    })

    app.get('/bookings', verifyToken, async (req, res) => {

      if(req.query?.email !== req.user.email){
        return res.status(403).send({message: 'forbidden access'});
      }
      const query = req.query?.email? {email: req.query.email} : {};
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })
  
    app.get('/services/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const options = {
        projection: {img: 1, title: 1, price: 1, service_id: 1},
      };
      const result = await servicesCollection.findOne(query, options);
      res.send(result);
    })

    app.post('/bookings', async (req, res) => {
      const service = req.body;
      const result = await bookingCollection.insertOne(service);
      res.send(result);
    })


    app.delete('/bookings/:id', async (req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    })


    app.patch('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const updatedBooking = req.body;
      const query = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          status: updatedBooking.status
        },
      };
      const result = await bookingCollection.updateOne(query, updateDoc);
      res.send(result);
    })


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) =>{
    res.send('car doctor server is running');
})


app.listen(port, () => {
    console.log(`car doctor server is running on port: ${port}`);
})