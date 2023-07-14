const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

app.use(express.json());
const databasePath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({ filename: databasePath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Started at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error : ${e.message}`);
    process.exit(-1);
  }
};
initializeDbAndServer();
//MiddleWare Function
const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401).send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401).send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};
//REGISTER API
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
        INSERT INTO user(username,name,password,gender,location) 
        VALUES ('${username}',
        '${name}',
        '${hashedPassword}',
        '${gender}',
        '${location}');`;
    await db.run(createUserQuery);
    response.status(200).send("User Created Successfully..!");
  } else {
    response.status(401).send("User Already exists");
  }
});
//LOGIN API
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400).send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      console.log(jwtToken);
      response.send({ jwtToken });
    } else {
      response.status(400).send("Invalid password");
    }
  }
});
//API 2
app.get("/states/", authenticationToken, async (request, response) => {
  const selectStatesQuery = `SELECT state_id as stateId,
  state_name as stateName,population FROM state`;
  const allStates = await db.all(selectStatesQuery);
  response.send(allStates);
});
//API 3
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const selectStatesQuery = `
        SELECT state_id as stateId,
        state_name as stateName,
        population FROM state WHERE state_id = ${stateId};`;
  const state = await db.get(selectStatesQuery);
  response.send(state);
});
//API 4
app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createNewDistrict = `
  INSERT INTO district (district_name, state_id,cases,cured,active,deaths)
   VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(createNewDistrict);
  response.send("District Successfully Added");
});
//API 5
const convertToCamelCase = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrict = `
    SELECT * FROM district WHERE district_id = ${districtId}`;
    const district = await db.get(getDistrict);
    response.send(convertToCamelCase(district));
  }
);
//API 6
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `
    DELETE FROM district WHERE district_id = ${districtId}`;
    await db.run(deleteDistrict);
    response.send("District Removed");
  }
);
//API 7
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    try {
      const {
        districtName,
        stateId,
        cases,
        cured,
        active,
        deaths,
      } = request.body;
      const { districtId } = request.params;
      const updateDistrict = `
        UPDATE district SET 
            district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths} 
        WHERE district_id = ${districtId};`;
      await db.run(updateDistrict);
      response.send("District Details Updated");
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
);
//API 8
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatistics = `
        SELECT sum(cases) as totalCases,
        sum(cured) as totalCured,
        sum(active) as totalActive,
        sum(deaths) as totalDeaths FROM district 
        WHERE state_id = ${stateId};`;
    const statistics = await db.get(getStatistics);
    response.send(statistics);
  }
);
module.exports = app;
