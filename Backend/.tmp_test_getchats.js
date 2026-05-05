const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();
const userId = '69ec8bc70c09d22650ec10c5';
const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1d' });
const url = 'http://localhost:5001/api/Chats/getchats';
fetch(url, { headers: { Authorization: 'Bearer ' + token } })
  .then(async (res) => {
    const data = await res.text();
    console.log('status', res.status);
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch (e) {
      console.log(data);
    }
  })
  .catch((err) => {
    console.error(err);
  });
