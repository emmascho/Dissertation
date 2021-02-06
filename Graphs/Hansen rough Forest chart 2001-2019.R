
library(ggplot2)
library(dplyr)

names(hansen_excel_2000_2019)

hansen <-hansen_excel_2000_2019


names(hansen)[1] <- "Year"
names(hansen)[2] <- "Forest"

plot(hansen)

(scatter <- ggplot(hansen, aes(x = Year, y = Forest, colour = "#1874CD")) +  # linking colour to a factor inside aes() ensures that the points' colour will vary according to the factor levels
    theme_bw()                            # Changing the theme to get rid of the grey background
    ylab("Forest loss (ha)") +                                                   # Changing the text of the y axis label
    xlab("Year")  + 
    geom_point())