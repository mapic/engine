#!/bin/bash
#export PAGER="/usr/bin/less -S"

export PGPASSWORD=$MAPIC_POSTGIS_PASSWORD
export PGUSER=$MAPIC_POSTGIS_USERNAME
export PGHOST=$MAPIC_POSTGIS_HOST



if test -z "$1"; then
	echo "Usage: $0 <outdir>" >&2
	exit 1
fi
OUTDIR="$1"
if test -e "${OUTDIR}"; then
	echo "Output dir already exist, will not proceed" >&2
	exit 1
fi

if test -z "${PGHOST}"; then
	echo -n "Enter postgis ip or hostname (no PGHOST env found): "
	read PGHOST
fi

mkdir -p "${OUTDIR}" || exit 1

cd "${OUTDIR}" || exit 1
echo "Dumping globals ..."
pg_dumpall -g > _globals.dump || exit 1
psql -XAtc "select datname from pg_catalog.pg_database where not datistemplate" |
while read DB; do
	echo "Dumping database ${DB} ..."
	pg_dump -Fc ${DB} > "db_${DB}.dump" || {
		echo "Something went wrong" >&2;
		exit 1
	}
done
echo "All cluster dumped in '${OUTDIR}'"
#psql -h postgis --username=docker systemapic
