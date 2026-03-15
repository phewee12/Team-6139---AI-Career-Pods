SELECT 'CREATE DATABASE careerpods_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'careerpods_test')\gexec
