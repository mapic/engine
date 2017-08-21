#!/bin/bash

if [ "$1" == "" ]; then
	exit 1 # missing args
fi

if [ "$2" == "" ]; then
	exit 1 # missing args
fi

if [ "$3" == "" ]; then
	exit 1 # missing args
fi

export PGPASSWORD=$MAPIC_POSTGIS_PASSWORD
export PGUSER=$MAPIC_POSTGIS_USERNAME
export PGHOST=$MAPIC_POSTGIS_HOST

# env
SHAPEFILE=$1
TABLE=$2
DATABASE=$3
ENCODING=$5
SRID="-s $4"
if [ "$4" == "" ]; then SRID=""; fi

# error file
TIMESTAMP=$(date +"%s")
ERRORFILE="shp2pgsql.$TIMESTAMP.error"

function check_errors() {

	# ERROR: encoding
	if grep -q 'LATIN' ./$ERRORFILE ; then
	    	
	    	# import with LATIN1 encoding
	    	import_latin_encoding

	fi
}

function import_latin_encoding() {

	# import with LATIN1 encoding
	echo "Importing with LATIN1 encoding..."
	ENCODING="-W 'LATIN1"

	# import again
	import
}

function import() {

	# import shapefile
	shp2pgsql -t 2D -D $SRID $ENCODING "$SHAPEFILE" $TABLE 2>./$ERRORFILE | PGPASSWORD=$MAPIC_PG_PASSWORD psql -q --host=$PGHOST --username=$MAPIC_PG_USERNAME $DATABASE

	# check for errors
	check_errors
}


function clean_up() {
	echo "Cleaning up"
	# remove shp2pgsql.error file
	rm ./$ERRORFILE
}


echo "    Importing SHAPFILE DEBUG!"
echo "    Shapfile: $SHAPEFILE"
echo "    DATABASE: $DATABASE"
echo "    TABLE: $TABLE"

# import shapefile to postgis
import

# clean up
clean_up