#!/usr/bin/env bash

pg_data_path="/var/lib/postgresql/data"
dump_path="$pg_data_path/dump/$PGENV"

if [[ $* != *--auto* ]]; then
  read -p $'\n💩 Enter the name of the dump file you want to create (leave empty to use current timestamp): ' dump_file_name
  dump_file_name="${dump_file_name%.sql}"
fi
dump_file_name="${dump_file_name:-$(date +%s)}"

mkdir -p $dump_path
dump_pathname="$dump_path/$dump_file_name.sql"

echo -e "💩 Dumping ${PGENV} database to ${dump_file_name}.sql... 💩\n"

pg_dump --clean --if-exists --column-inserts --attribute-inserts --verbose -f ${dump_pathname}

echo -e "\n💩 ${PGENV} database dump to ${dump_file_name}.sql complete 💩\n"
