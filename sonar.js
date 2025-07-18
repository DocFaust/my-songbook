
import sonarScanner from 'sonarqube-scanner';

const run = () => {
    sonarScanner.default(
        {
            serverUrl: 'https://sonar.faustens.de',
            token: process.env.SONAR_TOKEN,
            options: {
                'sonar.projectKey': 'my-songbook',
                'sonar.projectName': 'my-songbook',
                'sonar.sources': 'src',
                'sonar.tests': 'src',
                'sonar.inclusions': 'src/**/*',
                'sonar.test.inclusions': 'src/**/*.test.ts,src/**/*.spec.ts',
                'sonar.typescript.lcov.reportPaths': 'coverage/lcov.info',
                'sonar.javascript.lcov.reportPaths': 'coverage/lcov.info',
            },
        },
        () => {
            console.log('SonarQube scan complete');
        }
    );
};

run();
