let fs = require('fs');
const moduleJson = JSON.parse(fs.readFileSync('./module.json', 'utf8'));

console.log('VERSION:' + moduleJson.version);
console.log('COMPAT_MIN:' + moduleJson.compatibility.minimum);
console.log('COMPAT_VERIFIED:' + moduleJson.compatibility.verified);
console.log('COMPAT_MAX:' + moduleJson.compatibility.maximum);
