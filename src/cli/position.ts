import yargs from 'yargs';

// Delegates to command modules in the position-cmds directory

const cli = {
  description: 'Manage whirlpool positions',
  builder: () =>
    yargs(process.argv.slice(2))
      .usage('Usage: $0 <command> [options]')
      .strict()
      .commandDir('position-cmds', {
        extensions: ['js', 'ts'],
        visit: (commandModule) => commandModule.default
      })
      .demandCommand()
      .help(),
};

if (process.env.NO_EXEC_CLI !== 'true') {
  cli.builder().parse();
}

export default cli;
