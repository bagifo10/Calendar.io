import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD9sh-m9heUxcFpBvthsnXR_jl_rKtpPTE",
    authDomain: "calendario-5ad0f.firebaseapp.com",
    databaseURL: "https://calendario-5ad0f-default-rtdb.firebaseio.com",
    projectId: "calendario-5ad0f",
    storageBucket: "calendario-5ad0f.firebasestorage.app",
    messagingSenderId: "735215889244",
    appId: "1:735215889244:web:770f91872ecdf4c398ef99",
    measurementId: "G-VL1657B2PK"
};

const app = initializeApp(firebaseConfig);

export function getDb() {
    return getDatabase(app);
}
