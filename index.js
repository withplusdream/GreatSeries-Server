const fs = require("fs");
let express = require("express");
let app = express();
let http = require("http").Server(app);
let io = require("socket.io")(http);
let url = require("url");
const mongoose = require("mongoose");
const { Schema } = mongoose;
const cors = require("cors");
const { nextTick } = require("process");
const { join } = require("path");
require("dotenv").config();

/*== db연결 ==*/
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = process.env.ATLAS_URI; // mongoDB Connect 정보
console.log("uri", process.env.ATLAS_URI);
mongoose.connect(uri);

//uri 다음 부분이 작동이 안되서 일단 따로 빼놓음
// mongoose.connect(uri, {
//   useNewUrlParser: true,
//   useCreateIndex: true,
//   useUnifiedTopology: true,
// });

const connection = mongoose.connection;
connection.once("open", () => {
  console.log("MongoDB database connection success");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

//user정보 스키마
const userSchema = new Schema({
  name: {
    type: String,
  },
  password: {
    type: String,
  },
});

let Users = mongoose.model("users", userSchema);

/*== 채널시스템 관련 변수 ===*/

let channelCount = 0;
let roomCount = 0;
let teamCount = 0;
let userCount = 0;
let channels = [];
let rooms = [];
let teams = [];
let users = [];

/*== 채널시스템 관련 템플릿 ===*/

// 채널 템플릿
let channel_template = {
  id: -1,
  name: "",
  password: "1234",
  rooms: [],
};

// 룸 템플릿
let room_template = {
  id: -1,
  name: "",
  parent: null,
  teams: [],
  current_page: "TeamName",
  isLogin: false,
};

// 팀 템플릿
let team_template = {
  id: null,
  index: null,
  users: [],
  isLogin: false,
  name: "",
  current_page: "TeamName",
};

// 유저 템플릿
let user_template = {
  id: null,
  socket_id: null,
  isLogin: false,
  name: "",
  current_page: "TeamName",
};

// 관리자 리스트
let admin_list = [
  { id: "withplus", password: "1234" },
  { id: "minji", password: "4321" },
  { id: "tfstudio", password: "turtle" },
  { id: "greatdeal", password: "great1234" },
];

// 서버 실행 시 저장된 데이터파일 불러오기
fs.readFile("./data/save.json", "utf-8", (err, data) => {
  if (err) {
    console.log("No Data ========");
  } else {
    if (data) {
      let saved_data = JSON.parse(data.toString());
      channelCount = saved_data.channelCount;
      roomCount = saved_data.roomCount;
      teamCount = saved_data.teamCount;
      userCount = saved_data.userCount;
      channels = saved_data.channels;
      for (let channel of channels) {
        for (let room of channel.rooms) {
          room.parent = channel;
          rooms.push(room);
          for (let team of room.teams) {
            team.parent = room;
            teams.push(team);
            for (let user of team.users) {
              user.parent = team;
              users.push(user);
            }
          }
        }
      }
      console.log("Load Saved Data ========");
    } else {
      console.log("No Data ========");
    }
  }
});

// 데이터 저장 함수
let last_saved_time = Date.now();
let save_wait = false;
function saveData(filename) {
  let current_time = Date.now();
  if (current_time > last_saved_time + 1000 * 5) {
    let channels_ = [];
    for (let channel of channels) {
      let channel_ = {
        id: channel.id,
        name: channel.name,
        password: channel.password,
        rooms: [],
      };
      for (let room of channel.rooms) {
        let room_ = {
          ...room,
          parent: null,
          teams: [],
        };
        for (let team of room.teams) {
          let team_ = {
            ...team,
            parent: null,
            users: [],
          };
          for (let user of team.users) {
            let user_ = {
              ...user,
              parent: null,
            };
            team_.users.push(user_);
          }
          room_.teams.push(team_);
        }
        channel_.rooms.push(room_);
      }
      channels_.push(channel_);
    }

    const data = JSON.stringify({
      channelCount,
      roomCount,
      teamCount,
      userCount,
      channels: channels_,
    });

    // write JSON string to a file
    fs.writeFile(
      filename ? "./data/backup/" + filename + ".json" : "./data/save.json",
      data,
      (err) => {
        if (err) {
          console.log("admin save is fail.");
        } else {
          //console.log("JSON data is saved.");
        }
      }
    );
    last_saved_time = current_time;
    save_wait = false;
  } else {
    save_wait = true;
    setTimeout(function () {
      if (filename) saveData(filename);
      else if (save_wait) saveData();
    }, 1000 * 5);
  }
}

/*=== 원하는 path에 html 파일을 연결 ===*/

app.get("/", function (req, res) {
  let _url = req.url;
  res.sendFile(__dirname + "/index.html");
});

app.get("/test", function (req, res) {
  let _url = req.url;
  res.sendFile(__dirname + "/test.html");
});

app.get("/admin", function (req, res) {
  let _url = req.url;
  res.sendFile(__dirname + "/admin.html");
});

app.use("/", express.static(__dirname + "/"));
app.use("/public", express.static(__dirname + "/public"));

// 소켓 연결 시
io.on("connection", function (socket) {
  console.log("user connected");

  let onevent = socket.onevent;
  socket.onevent = function (packet) {
    let args = packet.data || [];
    onevent.call(this, packet); // original call

    // 패킷 데이터가 object 가 아니라 string 으로 들어왔을 시 변환
    if (packet.data[1] && typeof packet.data[1] == "string") {
      console.log("packet.data", packet.data);
      packet.data[1] = JSON.parse(packet.data[1]);
    }

    // 아래 모든이벤트 일괄적용을 위한 코드
    packet.data = ["*"].concat(args);

    onevent.call(this, packet); // additional call to catch-all
  };

  // 모든 이벤트 일괄 적용
  socket.on("*", function (event, data) {
    saveData();
  });

  // 소켓이 끊어졌을 시
  socket.on("disconnect", function () {
    console.log("user disconnected");
  });

  /* 테스트 페이지 */
  socket.on("SendTest", function (data) {
    let text = "";
    for (let prop in data) {
      if (text != "") text += ", ";
      text += "[" + prop + "] " + data[prop];
    }
    // Admin 페이지에 메세지를 전달함
    socket.emit("message", { text: "서버로 전송된 데이터\n" + text });
  });

  /*=== 게임 클라이언트 요청 이벤트 ===*/

  socket.on("SendUserInfo", function (data) {
    console.log("SendUserInfo", data);
    user = new Users({
      name: data.id,
      password: data.password,
    });
    user.save();
  });

  //회원가입 코드 -> 작동하는지 디버깅 필요
  const register = async (req, res) => {
    const { name, password } = req.body;
    try {
      let user = await Users.findOne({ name });
      if (user) {
        return res
          .status(400)
          .json({ errors: [{ msg: "User already exists" }] });
      }
      user = new User({
        name,
        password,
      });
    } catch (err) {
      console.error(error.message);
    }
  };

  // 채널 엑세스코드 확인
  socket.on("CheckChannelPassword", function (data) {
    socket.emit("CheckChannelPassword", {
      success: getChannel(data.id).password == data.channel_password,
    });
  });

  // 매니저 로그인 시 아이디, 비밀번호 확인
  socket.on("CheckLogin", function (data) {
    let adm = admin_list.filter(
      (adm) => adm.id == data.id && adm.password == data.password
    );
    socket.emit("CheckLogin", {
      success: adm.length > 0 ? true : false,
    });
  });

  // 유저 추가
  socket.on("CreateUser", function (data) {
    console.log("CreateUser", data);
    const team = getTeam(data.team_id);
    if (team) {
      if (createUser(socket.id, data.name, team)) {
        socket.emit("CreateUser");
      }
    }
  });

  // 모든팀 로그인
  socket.on("AllTeamLogin", function (data) {
    console.log("AllTeamLogin".data);
    io.to("room-" + data.room_id).emit("AllTeamLogin", data);
  });

  // 채널 리스트 요청
  socket.on("GetChannels", function (data) {
    socket.emit("GetChannels", {
      list: getChannelList(),
    });
  });

  // 룸 리스트 요청
  socket.on("GetRooms", function (data) {
    socket.emit("GetRooms", {
      list: getRoomList(data.id),
    });
  });

  // 팀 리스트 요청
  socket.on("GetTeams", function (data) {
    const room = getRoom(data.room_id);
    if (room) {
      let list = [];
      for (let i = 0; i < room.teams.length; i++) {
        list.push({
          id: room.teams[i].id,
          index: room.teams[i].index,
          name: room.teams[i].name,
        });
      }
      socket.emit("GetTeams", { list });
    }
  });

  // 유저 리스트 요청
  socket.on("GetUsers", function (data) {
    socket.emit("GetUsers", {
      list: getUserList(data.id),
    });
  });

  // 룸 리스트 페이지에서 룸선택 시 소켓의 해당 룸 join
  // 매니저 재 접속 시 저장된 데이터 받아옴
  socket.on("JoinRoom", function (data) {
    const room = getRoom(data.room_id);
    if (room) {
      socket.join("room-" + data.room_id);
      if (data.isAdmin) {
        if (room.isLogin) {
          socket.emit("LoadStatus", {
            page_name: room.current_page,
          });
        }
        room.isLogin = true;
      }

      let list = [];
      for (let i = 0; i < room.teams.length; i++) {
        list.push({
          id: room.teams[i].id,
          index: room.teams[i].index,
          name: room.teams[i].name,
        });
      }
      socket.emit("GetTeams", { list });
    }
  });

  // 팀 리스트 페이지에서 팀선택 시 소켓의 해당 팀 join
  // 유저 접속 시 저장된 데이터 받아옴
  socket.on("JoinTeam", function (data) {
    const team = getTeam(data.team_id);

    if (team && team.isLogin) {
      socket.join("team-" + team.id);
      socket.emit("LoadStatus", {
        page_name: team.current_page,
      });
    }
  });

  // 연결이 잠시 끊긴후 다시 소켓연결 시
  socket.on("Rejoin", function (data) {
    console.log("Rejoin");
    socket.join("room-" + data.room_id);

    if (data.isAdmin) {
      const room = getRoom(data.room_id);

      if (room) {
        socket.emit("LoadStatus", {
          page_name: room.current_page,
        });
      }
    }

    if (data.team_id != undefined && data.isAdmin != undefined) {
      socket.join("team-" + data.team_id);
      const team = getTeam(data.team_id);

      if (team) {
        socket.emit("LoadStatus", {
          page_name: team.current_page,
        });
      }
    }
  });

  // 현재 페이지 저장
  socket.on("SendCurrentPage", function (data) {
    console.log("SendCurrentPage", data);
    const team = getTeam(data.team_id);
    const room = getRoom(data.room_id);

    if (data.isAdmin) {
      if (room) room.current_page = data.page_name;
    } else {
      if (team) team.current_page = data.page_name;
    }
  });

  // 팀이름 입력후 전송시
  socket.on("SetTeamName", function (data) {
    const team = getTeam(data.id);
    const room = team.parent;

    if (team) {
      team.name = data.teamname;
      io.to("team-" + team.id).emit("SetTeamName", data);

      // 팀 로그인상태로 전환
      team.isLogin = true;

      // 모든 팀이 로그인했는지 확인
      let total = room.teams.length;
      let number = 0;
      for (let team_ of room.teams) {
        if (team_.isLogin) number++;
      }
      console.log(number + "/" + total);
      if (number == total)
        io.to("room-" + room.id).emit("AllTeamLogin", { room_id: room.id });
    }
  });

  /*=== Admin 웹페이지 기능 ===*/

  // 채널 추가
  socket.on("add_channel", function (data) {
    createChannel(data.name);
    socket.emit("getChannelList", { channel_list: getChannelList() });
    saveData();
  });

  // 룸 추가
  socket.on("add_room", function (data) {
    let channel = getChannel(data.channel_id);
    createRoom(data.name, channel);
    socket.emit("getRoomList", { room_list: getRoomList(data.channel_id) });
    saveData();
  });

  // 팀 추가
  socket.on("add_team", function (data) {
    const room = getRoom(data.room_id);
    if (room) {
      createTeam(data.name, room);
      let index = 0;
      for (let team of room.teams) {
        team.index = ++index;
      }
      socket.emit("getTeamList", { team_list: getTeamList(data.room_id) });
      saveData();
    }
  });

  // 채널 삭제
  socket.on("remove_channel", function (data) {
    let channel = getChannel(data.channel_id);
    if (channel) {
      for (let room of channel.rooms) {
        let idx = rooms.indexOf(room);
        rooms.splice(idx, 1);
      }

      idx = channels.indexOf(channel);
      channels.splice(idx, 1);

      socket.emit("getChannelList", { channel_list: getChannelList() });
      saveData();
    }
  });

  // 룸 삭제
  socket.on("remove_room", function (data) {
    let room = getRoom(data.room_id);
    let channel = room.parent;

    let idx = channel.rooms.indexOf(room);
    channel.rooms.splice(idx, 1);

    idx = rooms.indexOf(room);
    rooms.splice(idx, 1);

    socket.emit("getRoomList", { room_list: getRoomList(channel.id) });
    saveData();
  });

  // 팀 삭제
  socket.on("remove_team", function (data) {
    const team = getTeam(data.team_id);
    const room = team.parent;

    if (team) {
      let idx = room.teams.indexOf(team);
      room.teams.splice(idx, 1);

      idx = teams.indexOf(team);
      teams.splice(idx, 1);

      let index = 0;
      for (let team of room.teams) {
        team.index = ++index;
      }

      socket.emit("getTeamList", { team_list: getTeamList(room.id) });
      saveData();
    }
  });

  // 채널 리스트 요청
  socket.on("getChannelList", function (data) {
    socket.emit("getChannelList", { channel_list: getChannelList() });
  });

  // 룸 리스트 요청
  socket.on("getRoomList", function (data) {
    socket.emit("getRoomList", { room_list: getRoomList(data.channel_id) });
  });

  // 팀 리스트 요청
  socket.on("getTeamList", function (data) {
    socket.emit("getTeamList", { team_list: getTeamList(data.room_id) });
  });

  // 유저 리스트 요청
  socket.on("getUserList", function (data) {
    socket.emit("getUserList", { user_list: getUserList(data.team_id) });
  });

  // 채널 패스워드 요청
  socket.on("get_channel_password", function (data) {
    let channel = getChannel(data.channel_id);
    if (channel) {
      data.password = channel.password;
      socket.emit("get_channel_password", data);
    }
  });

  // 채널 패스워드 변경
  socket.on("change_channel_password", function (data) {
    let channel = getChannel(data.channel_id);
    if (channel) {
      channel.password = data.password;

      // Admin 페이지에 메세지를 전달함
      socket.emit("message", {
        text: "채널 패스워드가 '" + channel.password + "'로 변경되었습니다.",
      });
    }
  });

  // 룸 리셋
  socket.on("reset_room", function (data) {
    const room = getRoom(data.room_id);

    // Room 리셋
    room.current_page = "TeamName";
    room.isLogin = false;

    // Team 리셋
    for (let i = 0; i < room.teams.length; i++) {
      let team = room.teams[i];
      team.isLogin = false;
      team.name = i + 1 + "";
      team.users = [];
    }

    // Admin 페이지에 메세지를 전달함
    socket.emit("message", { text: "리셋에 성공했습니다." });
    saveData();
  });

  /*=== 데이터 수정 요청 ===*/
  socket.on("edit", function (data) {
    switch (data.type) {
      case "channel":
        editChannel(data.editData);
        break;
      case "room":
        editRoom(data.editData);
        break;
      case "team":
        editTeam(data.editData);
        break;
    }
  });
});

/*=== 채널시스템 관련함수 ===*/

// 채널 리스트 얻기
function getChannelList() {
  let list = [];

  for (let channel of channels) {
    list.push({
      id: channel.id,
      name: channel.name,
    });
  }
  return list;
}

// 룸 리스트 얻기
function getRoomList(channel_id) {
  let channel = getChannel(channel_id);
  if (channel) {
    let list = [];
    console.log(channel);
    for (let room of channel.rooms) {
      list.push({
        id: room.id,
        name: room.name,
      });
    }
    return list;
  }
}

// 팀 리스트 얻기
function getTeamList(room_id) {
  let room = getRoom(room_id);
  let list = [];
  console.log(room);
  for (let team of room.teams) {
    list.push({
      id: team.id,
      name: team.name,
    });
  }
  return list;
}

// 유저 리스트 얻기
function getUserList(team_id) {
  let team = getTeam(team_id);
  let list = [];
  console.log(team);
  for (let user of team.users) {
    list.push({
      id: user.id,
      name: user.name,
    });
  }
  return list;
}

// 채널아이디로 채널 얻기
function getChannel(id) {
  return channels.filter((channel) => channel.id == id)[0];
}

// 룸아이디로 룸 얻기
function getRoom(id) {
  return rooms.filter((room) => room.id == id)[0];
}

// 팀아이디로 팀 얻기
function getTeam(id) {
  return teams.filter((team) => team.id == id)[0];
}

// 유저아이디로 유저 얻기
function getUser(id) {
  return users.filter((user) => user.id == id)[0];
}

// 소켓아이디로 유저 얻기
function getUserSocketID(socket_id) {
  return users.filter((user) => user.socket_id == socket_id)[0];
}

// 채널 추가
function createChannel(name) {
  let channel = deepClone(channel_template);
  channel.name = name;
  channel.id = channelCount;
  channels.push(channel);
  channelCount++;

  return channel;
}

// 룸 추가
function createRoom(name, channel) {
  let room = deepClone(room_template);
  room.name = name;
  room.id = roomCount;
  room.parent = channel;
  channel.rooms.push(room);
  rooms.push(room);
  roomCount++;

  return room;
}

// 팀 추가
function createTeam(name, room) {
  let team = deepClone(team_template);
  team.name = name;
  team.id = teamCount;
  team.parent = room;
  room.teams.push(team);
  teams.push(team);
  teamCount++;

  return team;
}

// 유저 추가
function createUser(socket_id, name, team) {
  let user = {
    ...deepClone(user_template),
    name,
    socket_id,
    id: userCount,
    parent: team,
  };
  team.users.push(user);
  users.push(user);
  userCount++;

  return user;
}

// 유저 소켓아이디 변경
function changeUserSocketID(socket_id, id) {
  let user = getUser(id);
  if (user) {
    user.socket_id = socket_id;
    return user;
  }
}

/*=== 데이터 편집 ===*/

// 채널 데이터 편집
function editChannel(data) {
  const channel = getChannel(data.id);
  for (let prop in data) {
    channel[prop] = data[prop];
  }
  console.log(channel);
}

// 룸 데이터 편집
function editRoom(data) {
  const room = getRoom(data.id);
  for (let prop in data) {
    room[prop] = data[prop];
  }
  console.log(room);
}

// 팀 데이터 편집
function editTeam(data) {
  const team = getTeam(data.id);
  for (let prop in data) {
    team[prop] = data[prop];
  }
  console.log(team);
}

/*=== 기타 함수 ===*/

// 자바스크립트 오브젝트 복사
function deepClone(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  const result = Array.isArray(obj) ? [] : {};

  for (let key of Object.keys(obj)) {
    result[key] = deepClone(obj[key]);
  }

  return result;
}

/*=== 서버 시작 ===*/
http.listen(80, function () {
  console.log("listening on *:80");
});
