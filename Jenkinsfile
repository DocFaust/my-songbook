pipeline {
    agent any

    triggers {
        cron('H 8 * * *')
        // pollSCM('H/5 * * * *')
    }

    tools {
        nodejs 'nodejs'
    }

    environment {
        NVDAPIKEY      = credentials('nvd-api-key') // API key from Jenkins credentials
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
            steps {
                // Ensure directory exists
                sh 'mkdir -p dependency-check-bin'
                // Run OWASP Dependency Check
                sh 'npm run owasp'
                script {
                    // Update the last run timestamp
                    writeFile(file: env.DEP_CHECK_FILE, text: "${System.currentTimeMillis()}")
                }
            }
            post {
                success {
                    // Publish dependency check report
                    dependencyCheckPublisher pattern: 'dependency-check-report/dependency-check-report.xml'
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
    }
}
