sh 'npm run build:cli'
sh './packaging/build-deb.sh'
sh 'docker build -t taraflow-report:${VERSION} .'
// optional: sh 'docker run --rm -v $PWD:/data taraflow-report:${VERSION} /data/project.tara.json --format html --out /data/report.html'
