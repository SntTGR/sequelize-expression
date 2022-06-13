const { execSync } = require('child_process');
const { writeFileSync, rmSync, mkdirSync, copyFileSync } = require('fs');
const lib = require('../package.json')

const expectedFileOutput = `${lib.name}-${lib.version}.tgz`


console.log(`\x1b[1m\x1b[36m------------ Asserting import of package ${lib.name} v${lib.version}. ----------\x1b[0m`);

rmSync('./build/tmp', { recursive: true, force:true });
rmSync(`${expectedFileOutput}`, { force:true });
mkdirSync('./build/tmp');
copyFileSync('./build/package-assertion.js', './build/tmp/index.js');

console.log(`\x1b[34m== Packing ${lib.name}. ==\x1b[0m`);

execSync('npm pack --pack-destination ./build/tmp/');
execSync('npm pack');

console.log(`\x1b[34m== Installing ${expectedFileOutput}. ==`);

// npm install inside the tmp directory
execSync(`npm init --yes -w ./build/tmp`)
execSync(`npm install ${expectedFileOutput} -w tmp`)

console.log(`\x1b[34m== Asserting require(${lib.name}). ==`);

execSync(`cd ./build/tmp/ && node index.js`)

console.log('\x1b[32mALL DONE!');