import yargs from 'yargs';

yargs(process.argv.slice(2))
  .usage('Usage: $0 <command> [options]')
  .strict()
  .commandDir('position-cmds', {
    extensions: ['js', 'ts'],
    visit: (commandModule) => commandModule.default
  })
  .demandCommand()
  .help()
  .parse();
