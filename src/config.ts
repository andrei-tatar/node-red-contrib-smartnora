
export interface NoraConfig {
    group: string;
    email: string;
    password?: string;
    sso?: string;
}

export const API_ENDPOINT = 'https://api.smart-nora.eu';

const { name, version }: { name: string; version: string } = require('../package.json');
const USE_NAME = name.split('-').slice(-1)[0];
export const USER_AGENT = `${USE_NAME}/${version}`;

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
