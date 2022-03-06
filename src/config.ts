
export interface NoraConfig {
    group?: string;
    email: string;
    password?: string;
    sso?: string;
}

export const API_ENDPOINT = 'https://api.smart-nora.eu';

const { name, version } = require('../package.json');
export const USER_AGENT = `${name}/${version}`;

export const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyCE4ogvmNJG8Vvkzf1wfWKhjzCALlLGLsw',
    authDomain: 'nora-firebase.firebaseapp.com',
    databaseURL: 'https://nora-firebase-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'nora-firebase',
    storageBucket: 'nora-firebase.appspot.com',
    messagingSenderId: '887354663171',
    appId: '1:887354663171:web:e63beb2090a05a83284936',
    measurementId: 'G-SBHH6WNXZ1'
};
