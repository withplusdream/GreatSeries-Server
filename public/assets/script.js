var socket = io();
var onevent = socket.onevent;
var admin_device_id = GenerateSerialNumber("000000");

socket.onevent = function (packet) {
  var args = packet.data || [];
  onevent.call(this, packet);    // original call
  packet.data = ["*"].concat(args);
  onevent.call(this, packet);      // additional call to catch-all
};

socket.on('admin_login', function (data) {
  if (data.admin_device_id == admin_device_id) {
    console.log("admin init");
    init();
  }
});


(function () {
  $("#btn-admin-login").click(function () {
    socket.emit("admin_password", { "admin_device_id": admin_device_id, "admin_password": $("#admin-password").val() });
  });
})()



function init() {
  $("#blind").fadeOut(500);
  $(function () {
    socket.emit("get_team_numberof", { "room_id": parseInt($("#room_id").val()) });
    socket.emit("get_room_numberof", {});
    socket.emit("get_access_code", {});
    socket.emit("admin_room_id", { "room_id_type": "view", "room_id": parseInt($("#view_room_id").val()) });



    socket.on('*', function (event, data) {
      if (["admin_password", "admin_login", "get_admin_password", "change_admin_password"].indexOf(event) < 0) {
        console.log(event, data);
        $("#messages").append($("<li>" + new Date().toLocaleString() + " | &lt;" + event + "&gt; " + JSON.stringify(data) + "</li>"));
        $("#messages-container").scrollTop($("#messages").height());
      }
    });

    socket.on('access_code', function (data) {
      $("#access_code").val(data.access_code);
    });

    socket.on('set_access_code', function (data) {
      $("#access_code").addClass("highlight");
    });

    socket.on('room_numberof', function (data) {
      console.log(data);
      $("#room_numberof").val(data.room_numberof).attr("selected", "selected");
    });

    socket.on('team_info', function (data) {
      if (data.room_id == parseInt($("#view_room_id").val()) && data.team_info) {
        $info_list = $("#info-list");
        $info_list.html("");
        for (let info of data.team_info) {
          $info_list.append("<li class=" + (info.boat_moved ? "moved" : "") + (info.removed ? " removed" : "") + "><span>Team" + info.id + "</span><span>" + (info.removed ? "삭제됨" : info.boat_moved ? "이동완료" : "논의중") + "</span></li>");
        }
      }
    });


    socket.on('team_numberof', function (data) {
      if (data.room_id_type) {
        if (data.room_id_type == "control") {
          $team_id = $("#control_team_id");
          $team_id.html("");
          for (var i = 0; i < data.team_numberof; i++) {
            $team_id.append("<option value='" + (i + 1) + "'>" + (i + 1) + "</option>");
          }
        }
      }
      else {
        $("#team_numberof").val(data.team_numberof).attr("selected", "selected");
        if (data.room_id == parseInt($("#control_room_id").val())) {
          console.log("Debug", data.team_numberof);
          $team_id = $("#control_team_id");
          $team_id.html("");
          for (var i = 0; i < data.team_numberof; i++) {
            $team_id.append("<option value='" + (i + 1) + "'>" + (i + 1) + "</option>");
          }
        }
      }
    });

    socket.on('room_numberof', function (data) {
      $room_id = $(".room_id");
      $room_id.html("");
      for (var i = 0; i < data.room_numberof; i++) {
        $room_id.append("<option value='" + i + "'>" + (i + 1) + "</option>");
      }
    });

    var count = 0;
    $("#btn-reset").click(function () {
      socket.emit('reset', '{}');
      $("#info-list").html("");
    });

    $("#btn-room-reset").click(function () {
      var room_id = parseInt($("#view_room_id").val());
      if (confirm("정말 Room " + (room_id + 1) + " 의 데이터를 초기화 하시겠습니까?")) {
        socket.emit('room_reset', { "room_id": room_id });
        $("#info-list").html("");
      }
    });



    $("#room_numberof").change(function () {
      socket.emit("room_numberof", { "room_numberof": parseInt($("#room_numberof").val()) });
    });

    $(".room_id").change(function () {
      let room_id_type = $(this).attr("data-type");
      socket.emit("admin_room_id", { "room_id_type": room_id_type, "room_id": parseInt($(this).val()) });
    });

    $(".room_id").on("mouseenter", function () {
      if ($(this).children("option").length < 1) {
        socket.emit("get_room_numberof", {});
      }
    });

    $("#control_team_id").on("mouseenter", function () {
      console.log("MouseEnter");
      if ($(this).children("option").length < 1) {
        console.log("Empty");
        if ($("#control_room_id").children("option").length > 0) socket.emit("admin_room_id", { "room_id_type": "control", "room_id": parseInt($("#control_room_id").val()) });
      }
    });



    $("#team_numberof").change(function () {
      socket.emit("team_numberof", { "room_id": parseInt($("#room_id").val()), "team_numberof": parseInt($(this).val()) });
    });

    $("#access_code").change(function () {
      let access_code = $(this).val();
      socket.emit("set_access_code", { "access_code": access_code });
      $("#access_code").removeClass("highlight");
    });
    $("#btn-access_code").click(function () {
      let access_code = $("#access_code").val();
      socket.emit("set_access_code", { "access_code": access_code });
      $("#access_code").removeClass("highlight");
    });


    $("#btn-team-remove").click(function () {
      let room_id = parseInt($("#control_room_id").val());
      let id = parseInt($("#control_team_id").val());
      if (confirm("정말로 Room " + (room_id + 1) + " 의 Team " + id + " 을 삭제하시겠습니까?")) {
        socket.emit("remove_team", { "room_id": room_id, "id": id });
      }
    });

    $("#btn-team-reset").click(function () {
      let room_id = parseInt($("#control_room_id").val());
      let id = parseInt($("#control_team_id").val());
      if (confirm("정말로 Room " + (room_id + 1) + " 의 Team " + id + " 을 초기화하시겠습니까?")) {
        socket.emit("reset_team", { "room_id": room_id, "id": id });
      }
    });

    $("#btn-team-mate-permission").click(function () {
      let room_id = parseInt($("#control_room_id").val());
      let id = parseInt($("#control_team_id").val());
      if (confirm("정말로 Room " + (room_id + 1) + " 의 Team " + id + " 에 항해사 권한을 부여하시겠습니까?")) {
        socket.emit("team_mate_permission", { "room_id": room_id, "id": id });
      }
    });



    $("#btn-team-disable_block_permission").click(function () {
      let room_id = parseInt($("#control_room_id").val());
      let id = parseInt($("#control_team_id").val());
      if (confirm("정말로 Room " + (room_id + 1) + " 의 Team " + id + " 의 권한잠금을 해제하시겠습니까?")) {
        socket.emit("DisableBlockPermission", { "room_id": room_id, "id": id });
      }
    });

  });

}


function GenerateRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generates a random alphanumberic character
function GenerateRandomChar() {
  var chars = "1234567890ABCDEFGIJKLMNOPQRSTUVWXYZ";
  var randomNumber = GenerateRandomNumber(0, chars.length - 1);

  return chars[randomNumber];
}

// Generates a Serial Number, based on a certain mask
function GenerateSerialNumber(mask) {
  var serialNumber = "";

  if (mask != null) {
    for (var i = 0; i < mask.length; i++) {
      var maskChar = mask[i];

      serialNumber += maskChar == "0" ? GenerateRandomChar() : maskChar;
    }
  }

  return serialNumber;
}