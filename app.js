const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let database = null;

const initializationDbAndSever = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(-1);
  }
};

initializationDbAndSever();

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//login user API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `select * from user where username ='${username}';`;
  const dbUser = await database.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//GET states API
app.get("/states/", authenticationToken, async (request, response) => {
  const selectUserQuery = `
  SELECT 
    state.state_id AS stateId,
    state.state_name AS stateName,
    state.population AS population
    FROM
         state;`;
  const getAllStates = await database.all(selectUserQuery);
  response.send(getAllStates);
});

//GET state API
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
        SELECT 
            state.state_id AS stateId,
            state.state_name AS stateName,
            state.population AS population
        FROM 
            state
        WHERE 
            state_id = ${stateId};`;
  const dbResponse = await database.get(getStateQuery);
  response.send(dbResponse);
});

//POST district API
app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const insertDistrictQuery = `
    INSERT INTO
        district (district_name,state_id,cases,cured,active,deaths)
    VALUES(
        '${districtName}',
        '${stateId}',
        '${cases}',
        '${cured}',
        '${active}',
        '${deaths}'
    );`;
  const insertDistrict = await database.run(insertDistrictQuery);
  const insertId = insertDistrict.lastID;
  response.send("District Successfully Added");
});

//GET district API
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getStateQuery = `
        SELECT 
            district.district_id AS districtId,
            district.district_name AS districtName,
            district.state_id AS stateId,
            district.cases AS cases,
            district.cured AS cured,
            district.active AS active,
            district.deaths AS deaths
        FROM 
            district
        WHERE 
            district_id = ${districtId};`;
    const dbResponse = await database.get(getStateQuery);
    response.send(dbResponse);
  }
);

//DELETE district API
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
        SELECT
           *
        FROM 
            district
        WHERE
            district_id = ${districtId};`;
    await database.run(deleteQuery);
    response.send("District Removed");
  }
);

//PUT district API
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuey = `
    UPDATE
        district
    SET
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths};
    WHERE
        district_id = ${districtId}`;
    await database.run(updateQuey);
    response.send("District Details Updated");
  }
);

//GET totalCases API
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuarry = `
    SELECT
        SUM(cases),
        SUM(cured),
        SUM(active),
        SUM(deaths)
    FROM
        district
    WHERE
        state_id =${stateId};`;
    const stats = await database.get(getStateStatsQuarry);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
