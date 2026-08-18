# syntax=docker/dockerfile:1

FROM eclipse-temurin:25-jdk-noble AS build
WORKDIR /src
COPY gradlew settings.gradle.kts build.gradle.kts gradle.properties ./
COPY gradle gradle
RUN chmod +x gradlew
COPY src src
RUN ./gradlew bootJar --no-daemon -x test

FROM eclipse-temurin:25-jre-noble
WORKDIR /app
COPY --from=build /src/build/libs/app.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
