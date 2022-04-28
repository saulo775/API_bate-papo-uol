import express from "express";
import cors from "cors";
import { MongoClient} from "mongodb";
import Joi from "joi";

const PORT = 5001;
const DB_NAME = "UOL_batePapo";
const app = express();

app.use(express.json());
app.use(cors());

let database = null;
const mongoClient = new MongoClient("mongodb://localhost/27017");

const userSchema = Joi.object({
    name: Joi.string().not(null).required(),
})

app.post("/participants", async (req, res)=>{
    const {error, value} = userSchema.validate(req.body);

    if (error) {
        return res.sendStatus(422);
    }

    try{
        await mongoClient.connect();
        database = mongoClient.db(DB_NAME);
        const participants = database.collection("participants");

        const participantAlreadyExists = await participants.findOne(
            {name: value}
        );

        if (participantAlreadyExists) {
            mongoClient.close();
            return res.sendStatus(409);
        }

        await participants.insertOne(
            {name: value, lastStatus: Date.now()}
        );

        res.sendStatus(201);
        mongoClient.close();
    }catch(e){
        res.sendStatus(500);
        console.log("Não foi possível conectar ao banco de dados!");
        mongoClient.close();
    }
});

app.get("/participants", async (req, res)=>{
    try {
        await mongoClient.connect();
        const allParticipants = await mongoClient.db(DB_NAME).collection("participants").find().toArray();
        console.log(allParticipants);

        res.send(allParticipants);
        mongoClient.close();
    } catch (e) {
        console.log(e);
        res.sendStatus(500);
        mongoClient.close();
    }
})


app.listen(PORT, ()=>{
    console.log(`Servidor rodando na porta ${PORT}`)
})