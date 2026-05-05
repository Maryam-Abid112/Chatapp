import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios"; 
import "./signup.css";

const SignIn = () => {
  const navigate=useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async(e) => {
    let success=false;
    e.preventDefault();
    console.log("Email:", email);
    console.log("Password:", password);
    try{
      const  res=await axios.post("http://localhost:5001/api/Users/login",{
        email:email,
        password:password
      });
      // saves the token to localstorage for further use
      localStorage.setItem("token", res.data.token);
      localStorage.removeItem("Token");
      console.log("response", res.data);
      success = true;

    

    }catch(error){
        console.log("error log in ", error);

    }
      if(success){
        navigate("/Dashboard");

      }
  };

  return (
    <div className="container">
      <form className="form" onSubmit={handleSubmit}>
        <h2 className="heading">Sign In</h2>

        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" className="button">
          Login
        </button>
        <p>Don't have a Account? <span><Link to="/signup">Signup</Link></span></p>
      </form>
    </div>
  );
};


export default SignIn;