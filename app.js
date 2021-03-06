import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import Joi from "joi";
import dayjs from "dayjs";
import chalk from "chalk";
import 'dotenv/config';


const PORT = 5000;
const INTERVAL_EXEC_REMOVE_USERS = 15000;
const INTERVAL_REMOVE_USERS = 10000;

//const process.env.DB_NAME = "UOL_batePapo";
const app = express();

app.use(express.json());
app.use(cors());

let database = null;
const mongoClient = new MongoClient(process.env.DB_HOST);
const promise = mongoClient.connect();
promise.then(() => {
    database = mongoClient.db(process.env.DB_NAME);
    console.log(chalk.bold.blue("Conectado ao banco"));
});
promise.catch((e) => {
    console.log("Problema ao conectar ao banco de dados", e);
})

app.post("/participants", async (req, res) => {
    const userSchema = Joi.object({
        name: Joi.string().not(null).required()
    });

    const { error, value } = userSchema.validate(req.body);

    if (error) {
        return res.sendStatus(422);
    }

    try {
        const participantAlreadyExists = await database.collection("participants").findOne(
            { name: value.name }
        );

        if (participantAlreadyExists) {
            return res.sendStatus(409);
        }

        const date = Date.now();
        await database.collection("participants").insertOne(
            { name: value.name, lastStatus: date }
        );
        await database.collection("messages").insertOne(
            {
                from: value.name,
                to: "Todos",
                text: "Entra na sala...",
                type: "status",
                time: `${getExactHour()}`
            }
        );
        res.sendStatus(201);
    } catch (e) {
        res.status(500).send("Ocorreu um erro ao salvar os participantes", e);
    }
});

app.get("/participants", async (req, res) => {
    try {
        const allParticipants = await database.collection("participants").find().toArray();
        res.send(allParticipants);
    } catch (e) {
        console.log(e);
        res.status(500).send("Erro ao buscar os participantes", e);
    }
});

app.post("/messages", async (req, res) => {
    const messageSchema = Joi.object({
        to: Joi.string().not(null),
        text: Joi.string().not(null),
    });

    const { to, text, type } = req.body;
    const User = req.headers['user'];
    const { error, value } = messageSchema.validate({ to, text });

    if (error) {
        return res.sendStatus(422);
    }

    if (type !== "private_message" && type !== "message") {
        return res.sendStatus(422);
    }

    try {
        const messageDestinate = await database.collection("participants").findOne(
            { name: User }
        );
        if (messageDestinate === null) {
            return res.sendStatus(422);
        }

        await database.collection("messages").insertOne({
            from: messageDestinate.name,
            to: value.to,
            text: value.text,
            type: type,
            time: getExactHour(),
        });
        res.sendStatus(201);
    } catch (e) {
        console.log("N??o foi poss??vel salvar a mensagem!", e);
        res.sendStatus(500);
    }
});

app.get("/messages", async (req, res) => {
    const { limit } = req.query;
    const User = req.headers['user'];
    try {
        let messages = null;
        if (!limit) {
            messages = await database.collection("messages").find(
                {
                    $or: [
                        { from: User },
                        { to: User },
                        { to: 'Todos' },
                    ]
                }
            ).toArray();
        }
        else {
            messages = await database.collection("messages").find(
                {
                    $or: [
                        { from: User },
                        { to: User },
                        { to: 'Todos' },
                    ]
                }
            ).sort({ $natural: -1 }).limit(parseInt(limit)).toArray();
        }
        res.send(messages);
    } catch (e) {
        console.log("N??o foi poss??vel buscar as mensagens", e);
        res.status(500);
    }
});

app.put("/status", async (req, res) => {
    const User = req.headers['user'];

    try {
        const userToUpdate = await database.collection("participants").findOne(
            { name: User }
        );
        if (userToUpdate === null) {
            return res.sendStatus(404);
        }
        await database.collection("participants").findOneAndUpdate(
            { name: User },
            { $set: { lastStatus: Date.now() } }
        );
        res.sendStatus(200);
    } catch (e) {
        console.log("N??o foi poss??vel alterar o usu??rio", e);
        res.sendStatus(500);
    }
});

setInterval(() => {
    removeInativeParticipants();
},INTERVAL_EXEC_REMOVE_USERS);

async function removeInativeParticipants() {
    try {
        const allInativeParticipants = await database.collection("participants").find(
            {lastStatus:{ $lt: Date.now() - INTERVAL_REMOVE_USERS}}
        ).toArray();

        allInativeParticipants.map( async (participant)=>{
            await database.collection('participants').findOneAndDelete(
                {_id: new ObjectId(participant._id)}
            );
            await database.collection('messages').insertOne({
                from: participant.name,
                to: 'Todos',
                text: 'sai da sala...',
                type: 'status', 
                time: getExactHour()
            });
        });
    } catch (e) {
        console.log("N??o foi poss??vel remover os usu??rios inativos",e);
    }
}

function getExactHour() {
    const clock = dayjs(Date.now());
    return `${clock.hour()}:${clock.minute()}:${clock.second()}`;
}

app.listen(PORT, () => {
    console.log(chalk.bold.yellow(`Servidor rodando na porta ${PORT}`));
})
