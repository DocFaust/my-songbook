pipeline {
    agent any
    triggers {
        cron('H 8 * * *')
        //pollSCM('H/5 * * * *')
    }
    tools {
        nodejs 'nodejs'
    }
    environment {
        NVDAPIKEY = credentials('nvd-api-key') // API key from Jenkins credentials
        DEP_CHECK_FILE = 'dependency-check-last-run.txt'
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
                recordCoverage(tools: [[parser: 'CLOVER', path: 'coverage/clover.xml']])
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
        stage('Dependency Check') {
            when {
                expression {
                    def runCheck = true
                    if (fileExists(env.DEP_CHECK_FILE)) {
                        def lastRun = readFile(env.DEP_CHECK_FILE).trim()
                        def lastRunTime = lastRun as long
                        def currentTime = System.currentTimeMillis()
                        def timeDifference = currentTime - lastRunTime
                        // 86400000 milliseconds = 24 hours
                        // runCheck = timeDifference > 86400000
                        runCheck = timeDifference > 1000 * 60 * 60 * 1
                    }
                    return runCheck
                }
            }
            steps {
                sh 'mkdir -p dependency-check-bin' // Ensure directory exists
                sh 'npm run owasp' // Run OWASP Dependency Check
                script {
                    // Update the last run timestamp
                    writeFile(file: env.DEP_CHECK_FILE, text: "${System.currentTimeMillis()}")
                }
            }
            post {
                success {
                    dependencyCheckPublisher pattern: 'dependency-check-report/dependency-check-report.xml' // Publish dependency check report
                }
            }
        }
        stage('Security Audit') {
            steps {
                script {
                    // Ordner für Reports anlegen
                    sh 'mkdir -p reports/npm-audit'

                    // npm audit laufen lassen, aber den Build NICHT abbrechen
                    // --omit=dev: nur prod-Dependencies (optional)
                    // --audit-level=high: nur hohe/critical Issues (optional)
                    sh '''
                        npm audit --omit=dev --audit-level=high --json > reports/npm-audit/npm-audit.json || true
                    '''
                }
            }
            post {
                always {
                    npmAudit(pattern: 'reports/npm-audit/npm-audit.json')
                }
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('My Sonar') {
                    script {
                        def scannerHome = tool 'sonar'

                        sh """
                            ${scannerHome}/bin/sonar-scanner \
                              -Dsonar.projectKey=my-songbook \
                              -Dsonar.sources=src \
                              -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                        """
                    }
                }
            }
        }
    }
}