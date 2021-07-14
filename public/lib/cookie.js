function setCookie(name, value, day) {

  // 변수를 선언한다.
  var date = new Date();
  date.setDate(date.getDate() + day);

  var willCookie = "";
  willCookie += name + "=" + encodeURIComponent(value) + ";";
  willCookie += "Expires=" + date.toUTCString() + "";

  // 쿠키에 넣습니다.
  document.cookie = willCookie;
}

function getCookie(name) {

  // 변수를 선언한다.
  var cookies = document.cookie.split(";");

  // 쿠키를 추출한다.
  for (var i in cookies) {
    if (cookies[i].search(name) != -1) {
      return decodeURIComponent(cookies[i].replace(name + "=", ""));
    }
  }
}