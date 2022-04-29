import express from "express";
import cors from "cors";
import { MongoClient} from "mongodb";
import Joi from "joi";
import dayjs from "dayjs";

const PORT = 5001;
const DB_NAME = "UOL_batePapo";
const app = express();

app.use(express.json());
app.use(cors());

let database = null;
const mongoClient = new MongoClient("mongodb://localhost/27017");

const userSchema = Joi.object({
    name: Joi.string().not(null).required()
})

const messageSchema = Joi.object({
    to: Joi.string().not(null),
    text: Joi.string().not(null),
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
        const messages = database.collection("messages");

        const participantAlreadyExists = await participants.findOne(
            {name: value.name}
        );

        if (participantAlreadyExists) {
            mongoClient.close();
            return res.sendStatus(409);
        }

        const date = Date.now();
        const clock = dayjs(date);

        await participants.insertOne(
            {name: value.name, lastStatus: date}
        );

        await messages.insertOne(
            {
                from: value,
                to: "Todos",
                text: "Entra na sala...",
                type: "status",
                time: `${clock.hour()}:${clock.minute()}:${clock.second()}`
            }

        )

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
        res.send(allParticipants);
        mongoClient.close();
    } catch (e) {
        console.log(e);
        res.sendStatus(500);
        mongoClient.close();
    }
})

app.post("/messages", async (req, res, next)=>{
    const {to, text, type} = req.body;
    const User = req.headers['user']


    const {error, value} = messageSchema.validate({to, text});
    if (error) {
        return res.sendStatus(422);
    }

    if (type !== "private_message" && type !== "message") {
        return res.sendStatus(422);
    }

    try {
        await mongoClient.connect();
        const messageDestinate = await mongoClient.db(DB_NAME).collection("participants").findOne({name: User});
        if (messageDestinate === null) {
            return res.sendStatus(422);
        }
    } catch (e) {
        console.log("Não foi possível encontrar o usuário", e);
        res.status(422);
    }
    res.status(200).send(User);
});


app.listen(PORT, ()=>{
    console.log(`Servidor rodando na porta ${PORT}`)
})