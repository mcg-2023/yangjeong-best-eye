import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
export function createSqliteDatabase(filename=':memory:'){
  if(filename!==':memory:')mkdirSync(dirname(resolve(filename)),{recursive:true});
  const database=new DatabaseSync(filename);
  database.exec('CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY NOT NULL,data TEXT NOT NULL,status TEXT NOT NULL DEFAULT \'draft\',updated_at TEXT NOT NULL);CREATE INDEX IF NOT EXISTS posts_status_updated_idx ON posts(status,updated_at);');
  return {close:()=>database.close(),prepare(sql){const statement=database.prepare(sql);let args=[];const query={bind(...values){args=values;return query;},async all(){return {results:statement.all(...args)};},async first(){return statement.get(...args)??null;},async run(){return statement.run(...args);}};return query;}};
}
