-- Schema file for creating tables 

CREATE TABLE Member (
    member_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL
);

CREATE TABLE Circle (
    circle_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contribution_amount NUMERIC(10,2) NOT NULL
        CHECK (contribution_amount > 0),
    start_date DATE NOT NULL
);

CREATE TABLE Membership (
    member_id INT NOT NULL,
    circle_id INT NOT NULL,
    joined_on DATE NOT NULL,
    PRIMARY KEY (member_id, circle_id),
    CONSTRAINT fk_membership_member FOREIGN KEY (member_id) REFERENCES Member(member_id) ON DELETE CASCADE,
    CONSTRAINT fk_membership_circle FOREIGN KEY (circle_id) REFERENCES Circle(circle_id) ON DELETE CASCADE
);

CREATE TABLE Cycle (
    cycle_id INT AUTO_INCREMENT PRIMARY KEY,
    circle_id INT NOT NULL,
    seq_no INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    UNIQUE (circle_id, seq_no),
    CONSTRAINT fk_cycle_circle FOREIGN KEY (circle_id) REFERENCES Circle(circle_id) ON DELETE CASCADE
);

CREATE TABLE Contribution (
    contribution_id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    cycle_id INT NOT NULL,
    UNIQUE (member_id, cycle_id),
    CONSTRAINT fk_contribution_member FOREIGN KEY (member_id) REFERENCES Member(member_id),
    CONSTRAINT fk_contribution_cycle FOREIGN KEY (cycle_id) REFERENCES Cycle(cycle_id)
);

CREATE TABLE Bid (
    bid_id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    cycle_id INT NOT NULL,
    discount_rate NUMERIC(5,2) NOT NULL,
    UNIQUE (member_id, cycle_id),
    CONSTRAINT fk_bid_member FOREIGN KEY (member_id) REFERENCES Member(member_id),
    CONSTRAINT fk_bid_cycle FOREIGN KEY (cycle_id) REFERENCES Cycle(cycle_id)
);

CREATE TABLE Payout (
    cycle_id INT PRIMARY KEY,
    member_id INT NOT NULL,
    paid_at DATETIME NOT NULL,
    CONSTRAINT fk_payout_cycle FOREIGN KEY (cycle_id) REFERENCES Cycle(cycle_id),
    CONSTRAINT fk_payout_member FOREIGN KEY (member_id) REFERENCES Member(member_id)
);

CREATE TABLE DiscountShare (
    share_id INT AUTO_INCREMENT PRIMARY KEY,
    payout_cycle_id INT NOT NULL,
    member_id INT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    UNIQUE (payout_cycle_id, member_id),
    CONSTRAINT fk_discountshare_payout FOREIGN KEY (payout_cycle_id) REFERENCES Payout(cycle_id),
    CONSTRAINT fk_discountshare_member FOREIGN KEY (member_id) REFERENCES Member(member_id)
);