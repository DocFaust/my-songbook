pipeline {
    agent any
    triggers {
        cron('H 8 * * *')
        pollSCM('H/5 * * * *')
    }
    tools {
        nodejs 'nodejs'
    }
    environment {
        NVDAPIKEY = credentials('nvd-api-key') // API key from Jenkins credentials
    }
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }
        stage('Run Tests') {
            steps {
                sh 'npm run test:ci'
                publishCoverage adapters: [lcovAdapter('coverage/lcov.info')],
                                sourceFileResolver: sourceFiles('NEVER_STORE')
            }
        }
        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }
        stage('Run Lint') {
            steps {
                sh 'npm run lint:report'
                recordIssues tools: [checkStyle(pattern: 'eslint-report.xml')]
            }
        }
    }
}