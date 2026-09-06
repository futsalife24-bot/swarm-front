// Runs one fixed npm check and records its actual HEAD and exit status outside Git.
// All checks and evidence use dist-validation; no caller-supplied output path.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
const name = process.argv[2];
if (!['format:check','typecheck','test','test:integration','build','build:pages','server:build','test:offline','test:e2e'].includes(name)) throw new Error('Unknown check');
const directory = 'dist-validation'; mkdirSync(directory+'/evidence',{recursive:true});
const head = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const branch = execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim();
const clean = execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()==='';
const args = name==='test' ? ['test'] : ['run',name];
const command = 'npm.cmd '+args.join(' '), started = new Date().toISOString();
const child = process.platform==='win32' ? spawn(process.env.ComSpec || 'cmd.exe',['/d','/s','/c',command],{windowsHide:true}) : spawn('npm',args);
let output='';
child.stdout.on('data', b=>{output+=b;}); child.stderr.on('data', b=>{output+=b;});
child.on('error',()=>{console.error('Could not start check.');process.exitCode=1;});
child.on('close', code=>{
  const secret = existsSync('.dev.vars') ? /^ROOM_CREATION_KEY="([a-f0-9]+)"$/m.exec(readFileSync('.dev.vars','utf8'))?.[1] : undefined;
  const secretLeak = !!secret && output.includes(secret);
  if(secret) output=output.replaceAll(secret,'[REDACTED]');
  const log = `${directory}/${name.replaceAll(':','-')}-${Date.now()}.log`;
  writeFileSync(log,output);
  const path = directory+'/checks.json', checks=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):[];
  checks.push({command,head,branch,clean,started,finished:new Date().toISOString(),exitCode:code,secretLeak,log});
  writeFileSync(path,JSON.stringify(checks,null,2));
  console.log(JSON.stringify(checks.at(-1)));
  console.log(output.slice(-8000));
  process.exitCode=secretLeak ? 1 : code ?? 1;
});
